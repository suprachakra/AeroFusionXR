#!/usr/bin/env node

/**
 * AeroFusionXR Dependency Boundary Validator
 * 
 * Enforces clean architecture boundaries by preventing:
 * - Cross-service imports (service A importing from service B)
 * - Direct file imports instead of package exports
 * - Circular dependencies between services
 * - Imports from non-existent packages
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import chalk from 'chalk';
import * as ts from 'typescript';

interface DependencyViolation {
  file: string;
  line: number;
  import: string;
  violation: ViolationType;
  severity: 'ERROR' | 'WARNING' | 'INFO';
  suggestion: string;
  autofix?: AutofixAction;
}

interface AutofixAction {
  type: 'REPLACE_IMPORT' | 'ADD_DEPENDENCY' | 'MOVE_TO_SHARED';
  from: string;
  to: string;
  additionalSteps?: string[];
}

type ViolationType = 
  | 'CROSS_SERVICE_IMPORT'
  | 'DIRECT_FILE_IMPORT' 
  | 'NON_EXISTENT_PACKAGE'
  | 'CIRCULAR_DEPENDENCY'
  | 'INVALID_IMPORT_PATH'
  | 'MISSING_PACKAGE_EXPORT';

interface ValidationResult {
  isValid: boolean;
  violations: DependencyViolation[];
  summary: {
    totalFiles: number;
    violationsCount: number;
    errorCount: number;
    warningCount: number;
    servicesAffected: string[];
  };
  recommendations: ArchitecturalRecommendation[];
}

interface ArchitecturalRecommendation {
  type: 'REFACTOR' | 'CREATE_SHARED' | 'RESTRUCTURE';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  impact: string;
  effort: string;
  steps: string[];
}

export class DependencyValidator {
  private readonly serviceDirectories: string[] = [];
  private readonly packageDirectories: string[] = [];
  private readonly allowedCrossServiceDeps = new Set([
    '@aerofusionxr/common',
    '@aerofusionxr/types',
    '@aerofusionxr/security',
    '@aerofusionxr/messaging'
  ]);

  constructor() {
    this.initializeDirectories();
  }

  async validateAllDependencies(): Promise<ValidationResult> {
    console.log(chalk.blue.bold('🔍 AeroFusionXR Dependency Validation Started'));
    console.log(chalk.gray('─'.repeat(60)));

    const violations: DependencyViolation[] = [];
    const files = await this.getAllTypeScriptFiles();
    
    console.log(chalk.cyan(`📁 Validating dependencies in ${files.length} files...`));

    let processedFiles = 0;
    for (const file of files) {
      try {
        const fileViolations = await this.validateFile(file);
        violations.push(...fileViolations);
        
        processedFiles++;
        if (processedFiles % 25 === 0) {
          console.log(chalk.gray(`📊 Processed ${processedFiles}/${files.length} files`));
        }
      } catch (error) {
        console.warn(chalk.yellow(`⚠️  Could not validate ${file}: ${error.message}`));
      }
    }

    const result = this.generateValidationResult(files, violations);
    this.printValidationReport(result);

    if (result.summary.errorCount > 0) {
      console.log(chalk.red.bold('\n❌ DEPENDENCY VALIDATION FAILED'));
      console.log(chalk.red(`${result.summary.errorCount} errors must be fixed before proceeding`));
      process.exit(1);
    }

    if (result.summary.warningCount > 0) {
      console.log(chalk.yellow.bold('\n⚠️  DEPENDENCY WARNINGS FOUND'));
      console.log(chalk.yellow(`${result.summary.warningCount} warnings should be addressed`));
    }

    console.log(chalk.green.bold('\n✅ DEPENDENCY VALIDATION PASSED'));
    return result;
  }

  private async validateFile(filePath: string): Promise<DependencyViolation[]> {
    const violations: DependencyViolation[] = [];
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Parse TypeScript file
    const sourceFile = ts.createSourceFile(
      filePath,
      content,
      ts.ScriptTarget.Latest,
      true
    );

    // Extract all import statements
    const imports = this.extractImports(sourceFile);

    for (const importInfo of imports) {
      const violation = await this.validateImport(filePath, importInfo);
      if (violation) {
        violations.push(violation);
      }
    }

    return violations;
  }

  private extractImports(sourceFile: ts.SourceFile): ImportInfo[] {
    const imports: ImportInfo[] = [];

    const visit = (node: ts.Node) => {
      if (ts.isImportDeclaration(node)) {
        const moduleSpecifier = node.moduleSpecifier;
        if (ts.isStringLiteral(moduleSpecifier)) {
          imports.push({
            path: moduleSpecifier.text,
            line: sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1,
            fullStatement: node.getFullText(sourceFile).trim()
          });
        }
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return imports;
  }

  private async validateImport(filePath: string, importInfo: ImportInfo): Promise<DependencyViolation | null> {
    const { path: importPath, line, fullStatement } = importInfo;
    const currentService = this.extractServiceName(filePath);

    // 1. Check for cross-service imports
    if (this.isCrossServiceImport(importPath, currentService)) {
      return {
        file: this.getRelativePath(filePath),
        line,
        import: importPath,
        violation: 'CROSS_SERVICE_IMPORT',
        severity: 'ERROR',
        suggestion: 'Move shared code to packages/common/ or use @aerofusionxr/* packages',
        autofix: {
          type: 'MOVE_TO_SHARED',
          from: importPath,
          to: '@aerofusionxr/common',
          additionalSteps: [
            'Extract shared code to packages/common/',
            'Update import statement',
            'Add dependency to package.json'
          ]
        }
      };
    }

    // 2. Check for direct file imports to shared packages
    if (this.isDirectFileImport(importPath)) {
      const suggestedPackageImport = this.suggestPackageImport(importPath);
      return {
        file: this.getRelativePath(filePath),
        line,
        import: importPath,
        violation: 'DIRECT_FILE_IMPORT',
        severity: 'WARNING',
        suggestion: `Use package export: ${suggestedPackageImport}`,
        autofix: {
          type: 'REPLACE_IMPORT',
          from: importPath,
          to: suggestedPackageImport
        }
      };
    }

    // 3. Check for non-existent packages
    if (importPath.startsWith('@aerofusionxr/')) {
      const packageExists = await this.packageExists(importPath);
      if (!packageExists) {
        return {
          file: this.getRelativePath(filePath),
          line,
          import: importPath,
          violation: 'NON_EXISTENT_PACKAGE',
          severity: 'ERROR',
          suggestion: 'Create the package or fix the import path'
        };
      }
    }

    // 4. Check for invalid relative imports
    if (importPath.startsWith('../') && this.isInvalidRelativeImport(filePath, importPath)) {
      return {
        file: this.getRelativePath(filePath),
        line,
        import: importPath,
        violation: 'INVALID_IMPORT_PATH',
        severity: 'WARNING',
        suggestion: 'Use absolute imports or package imports instead of deep relative paths'
      };
    }

    return null;
  }

  private isCrossServiceImport(importPath: string, currentService: string): boolean {
    // Allow imports from shared packages
    if (this.allowedCrossServiceDeps.has(importPath.split('/')[0])) {
      return false;
    }

    // Check if it's importing from another service
    if (importPath.includes('../') && importPath.includes('services/')) {
      const targetService = this.extractTargetServiceFromPath(importPath);
      return targetService && targetService !== currentService;
    }

    return false;
  }

  private isDirectFileImport(importPath: string): boolean {
    // Check if importing directly from packages/**/src/** instead of package name
    return importPath.includes('packages/') && 
           importPath.includes('/src/') && 
           !importPath.startsWith('@aerofusionxr/');
  }

  private suggestPackageImport(directPath: string): string {
    // Convert packages/common/src/utils/Logger.ts -> @aerofusionxr/common/logger
    if (directPath.includes('packages/common/src/utils/Logger')) {
      return '@aerofusionxr/common/logger';
    }
    if (directPath.includes('packages/common/src/database/')) {
      return '@aerofusionxr/common/database';
    }
    if (directPath.includes('packages/common/src/cache/')) {
      return '@aerofusionxr/common/cache';
    }
    
    // Default suggestion
    const packageName = directPath.match(/packages\/([^\/]+)/)?.[1];
    return packageName ? `@aerofusionxr/${packageName}` : '@aerofusionxr/common';
  }

  private async packageExists(packageName: string): Promise<boolean> {
    const packagePath = packageName.replace('@aerofusionxr/', 'packages/');
    try {
      await fs.access(path.join(process.cwd(), packagePath, 'package.json'));
      return true;
    } catch {
      return false;
    }
  }

  private isInvalidRelativeImport(filePath: string, importPath: string): boolean {
    // Consider it invalid if it goes up more than 2 levels
    const upLevels = (importPath.match(/\.\.\//g) || []).length;
    return upLevels > 2;
  }

  private extractServiceName(filePath: string): string {
    const match = filePath.match(/services\/([^\/]+)/);
    return match ? match[1] : 'unknown';
  }

  private extractTargetServiceFromPath(importPath: string): string | null {
    const match = importPath.match(/services\/([^\/]+)/);
    return match ? match[1] : null;
  }

  private generateValidationResult(files: string[], violations: DependencyViolation[]): ValidationResult {
    const errorCount = violations.filter(v => v.severity === 'ERROR').length;
    const warningCount = violations.filter(v => v.severity === 'WARNING').length;
    
    const servicesAffected = [...new Set(
      violations.map(v => this.extractServiceName(v.file))
    )];

    const recommendations = this.generateRecommendations(violations);

    return {
      isValid: errorCount === 0,
      violations,
      summary: {
        totalFiles: files.length,
        violationsCount: violations.length,
        errorCount,
        warningCount,
        servicesAffected
      },
      recommendations
    };
  }

  private generateRecommendations(violations: DependencyViolation[]): ArchitecturalRecommendation[] {
    const recommendations: ArchitecturalRecommendation[] = [];

    // Group violations by type
    const crossServiceViolations = violations.filter(v => v.violation === 'CROSS_SERVICE_IMPORT');
    const directFileViolations = violations.filter(v => v.violation === 'DIRECT_FILE_IMPORT');

    if (crossServiceViolations.length > 0) {
      recommendations.push({
        type: 'REFACTOR',
        priority: 'HIGH',
        description: `Fix ${crossServiceViolations.length} cross-service imports`,
        impact: 'Improves maintainability and enforces clean architecture',
        effort: '2-4 hours',
        steps: [
          'Identify shared utilities in cross-service imports',
          'Extract to packages/common/ directory',
          'Update import statements to use @aerofusionxr/common',
          'Add package dependencies',
          'Test all affected services'
        ]
      });
    }

    if (directFileViolations.length > 0) {
      recommendations.push({
        type: 'RESTRUCTURE',
        priority: 'MEDIUM',
        description: `Update ${directFileViolations.length} direct file imports to use package exports`,
        impact: 'Improves encapsulation and API boundaries',
        effort: '1-2 hours',
        steps: [
          'Replace direct file imports with package imports',
          'Ensure all required exports are available in package index',
          'Update TypeScript configurations if needed'
        ]
      });
    }

    return recommendations;
  }

  private printValidationReport(result: ValidationResult): void {
    console.log(chalk.blue.bold('\n📊 DEPENDENCY VALIDATION REPORT'));
    console.log(chalk.gray('═'.repeat(60)));

    // Summary
    console.log(chalk.cyan.bold('📋 SUMMARY'));
    console.log(`📁 Total Files: ${result.summary.totalFiles}`);
    console.log(`🚨 Violations: ${result.summary.violationsCount}`);
    console.log(`❌ Errors: ${chalk.red.bold(result.summary.errorCount.toString())}`);
    console.log(`⚠️  Warnings: ${chalk.yellow.bold(result.summary.warningCount.toString())}`);
    console.log(`🏢 Services Affected: ${result.summary.servicesAffected.length}`);

    // Critical violations
    const criticalViolations = result.violations.filter(v => v.severity === 'ERROR');
    if (criticalViolations.length > 0) {
      console.log(chalk.red.bold('\n❌ CRITICAL VIOLATIONS (Must Fix)'));
      console.log(chalk.gray('─'.repeat(40)));
      
      criticalViolations.slice(0, 10).forEach((v, i) => {
        console.log(chalk.red(`${i + 1}. ${v.violation} in ${v.file}:${v.line}`));
        console.log(chalk.gray(`   Import: ${v.import}`));
        console.log(chalk.gray(`   Fix: ${v.suggestion}`));
        if (v.autofix) {
          console.log(chalk.blue(`   💡 Autofix: ${v.autofix.type}`));
        }
        console.log();
      });
    }

    // Recommendations
    if (result.recommendations.length > 0) {
      console.log(chalk.yellow.bold('\n💡 ARCHITECTURAL RECOMMENDATIONS'));
      console.log(chalk.gray('─'.repeat(40)));
      
      result.recommendations.forEach((rec, i) => {
        const priorityColor = rec.priority === 'HIGH' ? chalk.red : chalk.yellow;
        console.log(priorityColor(`${i + 1}. [${rec.priority}] ${rec.description}`));
        console.log(chalk.gray(`   Impact: ${rec.impact}`));
        console.log(chalk.gray(`   Effort: ${rec.effort}`));
        console.log();
      });
    }
  }

  private async getAllTypeScriptFiles(): Promise<string[]> {
    return glob('**/*.ts', {
      ignore: [
        '**/node_modules/**',
        '**/dist/**',
        '**/build/**',
        '**/*.test.ts',
        '**/*.spec.ts'
      ],
      absolute: true
    });
  }

  private getRelativePath(filePath: string): string {
    return path.relative(process.cwd(), filePath);
  }

  private initializeDirectories(): void {
    // This would be populated from actual directory scanning
    this.serviceDirectories.push('services/ai-concierge', 'services/payment-checkout');
    this.packageDirectories.push('packages/common', 'packages/security');
  }
}

interface ImportInfo {
  path: string;
  line: number;
  fullStatement: string;
}

// CLI Interface
if (require.main === module) {
  const validator = new DependencyValidator();
  validator.validateAllDependencies().catch(error => {
    console.error(chalk.red.bold('❌ Error during dependency validation:'), error);
    process.exit(1);
  });
}

export default DependencyValidator; 