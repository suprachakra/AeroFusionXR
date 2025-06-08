#!/usr/bin/env node

/**
 * AeroFusionXR Code Duplication Detector & Eliminator
 * 
 * This script automatically detects code duplication across the entire monorepo
 * and provides actionable recommendations for refactoring into shared libraries.
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { glob } from 'glob';
import chalk from 'chalk';

interface DuplicateBlock {
  content: string;
  hash: string;
  locations: FileLocation[];
  lines: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

interface FileLocation {
  file: string;
  startLine: number;
  endLine: number;
  service: string;
}

interface DuplicationReport {
  totalFiles: number;
  duplicatedBlocks: DuplicateBlock[];
  duplicationPercentage: number;
  criticalDuplicates: DuplicateBlock[];
  recommendations: RefactoringRecommendation[];
  summary: {
    totalDuplicatedLines: number;
    potentialSavings: number;
    worstOffenders: string[];
  };
}

interface RefactoringRecommendation {
  type: 'EXTRACT_TO_COMMON' | 'CREATE_SHARED_UTIL' | 'MERGE_IMPLEMENTATIONS';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  affectedFiles: string[];
  suggestedLocation: string;
  estimatedEffort: string;
}

export class DuplicationDetector {
  private readonly excludePatterns = [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/*.test.ts',
    '**/*.spec.ts',
    '**/coverage/**',
    '**/.git/**'
  ];

  private readonly includePatterns = [
    'services/**/*.ts',
    'packages/**/*.ts',
    'clients/**/*.ts'
  ];

  private readonly minBlockSize = 10; // Minimum lines to consider duplication
  private readonly hashCache = new Map<string, string>();

  async scanForDuplicates(): Promise<DuplicationReport> {
    console.log(chalk.blue.bold('🔍 AeroFusionXR Duplication Detection Started'));
    console.log(chalk.gray('─'.repeat(60)));

    const files = await this.getAllSourceFiles();
    console.log(chalk.cyan(`📁 Scanning ${files.length} files...`));

    const duplicates = await this.findDuplicatedBlocks(files);
    const report = this.generateReport(files, duplicates);

    this.printReport(report);
    
    if (report.duplicationPercentage > 5) {
      console.log(chalk.red.bold('\n❌ DUPLICATION THRESHOLD EXCEEDED'));
      console.log(chalk.red(`Current: ${report.duplicationPercentage}% | Threshold: 5%`));
      process.exit(1);
    }

    console.log(chalk.green.bold('\n✅ DUPLICATION CHECK PASSED'));
    return report;
  }

  private async getAllSourceFiles(): Promise<string[]> {
    const allFiles: string[] = [];

    for (const pattern of this.includePatterns) {
      const files = await glob(pattern, {
        ignore: this.excludePatterns,
        absolute: true
      });
      allFiles.push(...files);
    }

    return [...new Set(allFiles)]; // Remove duplicates
  }

  private async findDuplicatedBlocks(files: string[]): Promise<DuplicateBlock[]> {
    const blockHashes = new Map<string, DuplicateBlock>();
    let processedFiles = 0;

    for (const file of files) {
      try {
        const content = await fs.readFile(file, 'utf-8');
        const lines = content.split('\n');
        
        // Extract meaningful code blocks (skip comments, empty lines)
        const meaningfulLines = this.extractMeaningfulLines(lines);
        
        // Generate sliding window hashes
        for (let i = 0; i <= meaningfulLines.length - this.minBlockSize; i++) {
          const block = meaningfulLines.slice(i, i + this.minBlockSize);
          const blockContent = block.join('\n');
          const hash = this.generateHash(blockContent);

          if (blockHashes.has(hash)) {
            // Found duplicate
            const existing = blockHashes.get(hash)!;
            existing.locations.push({
              file: this.getRelativePath(file),
              startLine: this.getOriginalLineNumber(lines, meaningfulLines, i),
              endLine: this.getOriginalLineNumber(lines, meaningfulLines, i + this.minBlockSize - 1),
              service: this.extractServiceName(file)
            });
          } else {
            // First occurrence
            blockHashes.set(hash, {
              content: blockContent,
              hash,
              locations: [{
                file: this.getRelativePath(file),
                startLine: this.getOriginalLineNumber(lines, meaningfulLines, i),
                endLine: this.getOriginalLineNumber(lines, meaningfulLines, i + this.minBlockSize - 1),
                service: this.extractServiceName(file)
              }],
              lines: this.minBlockSize,
              severity: this.calculateSeverity(this.minBlockSize)
            });
          }
        }

        processedFiles++;
        if (processedFiles % 10 === 0) {
          console.log(chalk.gray(`📊 Processed ${processedFiles}/${files.length} files`));
        }
      } catch (error) {
        console.warn(chalk.yellow(`⚠️  Could not process ${file}: ${error.message}`));
      }
    }

    // Return only blocks that appear in multiple locations
    return Array.from(blockHashes.values())
      .filter(block => block.locations.length > 1)
      .sort((a, b) => b.locations.length - a.locations.length);
  }

  private extractMeaningfulLines(lines: string[]): string[] {
    return lines
      .map(line => line.trim())
      .filter(line => {
        // Skip empty lines
        if (!line) return false;
        
        // Skip comment-only lines
        if (line.startsWith('//') || line.startsWith('*') || line.startsWith('/*')) return false;
        
        // Skip import/export statements (too generic)
        if (line.startsWith('import ') || line.startsWith('export ')) return false;
        
        // Skip simple braces
        if (line === '{' || line === '}' || line === ');') return false;
        
        return true;
      });
  }

  private generateHash(content: string): string {
    if (this.hashCache.has(content)) {
      return this.hashCache.get(content)!;
    }

    const hash = crypto.createHash('md5').update(content).digest('hex');
    this.hashCache.set(content, hash);
    return hash;
  }

  private calculateSeverity(lines: number): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (lines >= 50) return 'CRITICAL';
    if (lines >= 30) return 'HIGH';
    if (lines >= 20) return 'MEDIUM';
    return 'LOW';
  }

  private generateReport(files: string[], duplicates: DuplicateBlock[]): DuplicationReport {
    const totalLines = files.length * 100; // Approximate
    const duplicatedLines = duplicates.reduce((sum, dup) => sum + (dup.lines * dup.locations.length), 0);
    const duplicationPercentage = Math.round((duplicatedLines / totalLines) * 100);

    const criticalDuplicates = duplicates.filter(dup => dup.severity === 'CRITICAL' || dup.severity === 'HIGH');
    const recommendations = this.generateRecommendations(duplicates);

    // Find worst offenders (files with most duplicates)
    const fileOccurrences = new Map<string, number>();
    duplicates.forEach(dup => {
      dup.locations.forEach(loc => {
        fileOccurrences.set(loc.file, (fileOccurrences.get(loc.file) || 0) + 1);
      });
    });

    const worstOffenders = Array.from(fileOccurrences.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([file]) => file);

    return {
      totalFiles: files.length,
      duplicatedBlocks: duplicates,
      duplicationPercentage,
      criticalDuplicates,
      recommendations,
      summary: {
        totalDuplicatedLines: duplicatedLines,
        potentialSavings: Math.round(duplicatedLines * 0.8), // 80% reduction potential
        worstOffenders
      }
    };
  }

  private generateRecommendations(duplicates: DuplicateBlock[]): RefactoringRecommendation[] {
    const recommendations: RefactoringRecommendation[] = [];

    // Group duplicates by type
    const utilityDuplicates = duplicates.filter(dup => 
      dup.content.includes('export class') || dup.content.includes('export function')
    );

    const logicDuplicates = duplicates.filter(dup => 
      !utilityDuplicates.includes(dup) && dup.locations.length > 2
    );

    // Recommend extracting utilities to common package
    utilityDuplicates.forEach(dup => {
      const className = this.extractClassName(dup.content);
      recommendations.push({
        type: 'EXTRACT_TO_COMMON',
        priority: dup.severity === 'CRITICAL' ? 'HIGH' : 'MEDIUM',
        description: `Extract ${className || 'utility'} to @aerofusionxr/common package`,
        affectedFiles: dup.locations.map(loc => loc.file),
        suggestedLocation: `packages/common/src/utils/${className || 'SharedUtility'}.ts`,
        estimatedEffort: dup.locations.length > 5 ? '4-6 hours' : '2-3 hours'
      });
    });

    // Recommend creating shared utilities for common logic
    logicDuplicates.forEach(dup => {
      recommendations.push({
        type: 'CREATE_SHARED_UTIL',
        priority: dup.locations.length > 5 ? 'HIGH' : 'MEDIUM',
        description: `Create shared utility for duplicated logic (${dup.locations.length} occurrences)`,
        affectedFiles: dup.locations.map(loc => loc.file),
        suggestedLocation: `packages/common/src/utils/SharedLogic.ts`,
        estimatedEffort: '3-4 hours'
      });
    });

    return recommendations.sort((a, b) => {
      const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private printReport(report: DuplicationReport): void {
    console.log(chalk.blue.bold('\n📊 DUPLICATION REPORT'));
    console.log(chalk.gray('═'.repeat(60)));

    // Summary
    console.log(chalk.cyan.bold('📋 SUMMARY'));
    console.log(`📁 Total Files: ${report.totalFiles}`);
    console.log(`🔄 Duplicate Blocks: ${report.duplicatedBlocks.length}`);
    console.log(`📊 Duplication: ${chalk.bold(report.duplicationPercentage + '%')}`);
    console.log(`🚨 Critical Issues: ${report.criticalDuplicates.length}`);
    console.log(`💾 Potential Savings: ${report.summary.potentialSavings} lines`);

    // Critical duplicates
    if (report.criticalDuplicates.length > 0) {
      console.log(chalk.red.bold('\n🚨 CRITICAL DUPLICATES'));
      console.log(chalk.gray('─'.repeat(40)));
      
      report.criticalDuplicates.slice(0, 5).forEach((dup, i) => {
        console.log(chalk.red(`${i + 1}. ${dup.lines} lines duplicated in ${dup.locations.length} files`));
        dup.locations.slice(0, 3).forEach(loc => {
          console.log(chalk.gray(`   📄 ${loc.file}:${loc.startLine}-${loc.endLine}`));
        });
        if (dup.locations.length > 3) {
          console.log(chalk.gray(`   ... and ${dup.locations.length - 3} more`));
        }
      });
    }

    // Recommendations
    if (report.recommendations.length > 0) {
      console.log(chalk.yellow.bold('\n💡 RECOMMENDATIONS'));
      console.log(chalk.gray('─'.repeat(40)));
      
      report.recommendations.slice(0, 5).forEach((rec, i) => {
        const priorityColor = rec.priority === 'HIGH' ? chalk.red : rec.priority === 'MEDIUM' ? chalk.yellow : chalk.gray;
        console.log(priorityColor(`${i + 1}. [${rec.priority}] ${rec.description}`));
        console.log(chalk.gray(`   📍 ${rec.suggestedLocation}`));
        console.log(chalk.gray(`   ⏱️  ${rec.estimatedEffort}`));
        console.log(chalk.gray(`   📂 ${rec.affectedFiles.length} files affected`));
        console.log();
      });
    }

    // Worst offenders
    if (report.summary.worstOffenders.length > 0) {
      console.log(chalk.magenta.bold('\n🔥 WORST OFFENDERS'));
      console.log(chalk.gray('─'.repeat(40)));
      report.summary.worstOffenders.forEach((file, i) => {
        console.log(chalk.magenta(`${i + 1}. ${file}`));
      });
    }
  }

  private extractClassName(content: string): string | null {
    const match = content.match(/export class (\w+)/);
    return match ? match[1] : null;
  }

  private extractServiceName(filePath: string): string {
    const parts = filePath.split(path.sep);
    const servicesIndex = parts.findIndex(part => part === 'services');
    return servicesIndex !== -1 && parts[servicesIndex + 1] ? parts[servicesIndex + 1] : 'unknown';
  }

  private getRelativePath(filePath: string): string {
    return path.relative(process.cwd(), filePath);
  }

  private getOriginalLineNumber(originalLines: string[], meaningfulLines: string[], meaningfulIndex: number): number {
    // This is a simplified approach - in practice, we'd need to track line mappings
    return meaningfulIndex + 1;
  }
}

// CLI Interface
if (require.main === module) {
  const detector = new DuplicationDetector();
  detector.scanForDuplicates().catch(error => {
    console.error(chalk.red.bold('❌ Error during duplication detection:'), error);
    process.exit(1);
  });
}

export default DuplicationDetector; 