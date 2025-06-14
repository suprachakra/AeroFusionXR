#!/usr/bin/env node

/**
 * AeroFusionXR Compliance Checker
 * Validates regulatory compliance across all governance frameworks
 */

const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

class ComplianceChecker {
  constructor() {
    this.results = {
      frameworks: {},
      overall_compliance: 0,
      status: 'UNKNOWN',
      violations: [],
      recommendations: []
    };
    
    this.frameworks = [
      { id: 'GDPR', name: 'General Data Protection Regulation', weight: 0.25 },
      { id: 'SOX', name: 'Sarbanes-Oxley Act', weight: 0.20 },
      { id: 'ISO27001', name: 'ISO 27001 Information Security', weight: 0.20 },
      { id: 'NIST_CSF', name: 'NIST Cybersecurity Framework', weight: 0.15 },
      { id: 'PCI_DSS', name: 'Payment Card Industry DSS', weight: 0.10 },
      { id: 'CCPA', name: 'California Consumer Privacy Act', weight: 0.10 }
    ];
  }

  async checkAllCompliance() {
    console.log(chalk.blue('🔍 Starting comprehensive compliance validation...\n'));

    let totalScore = 0;
    let totalWeight = 0;

    for (const framework of this.frameworks) {
      const result = await this.checkFrameworkCompliance(framework);
      this.results.frameworks[framework.id] = result;
      
      totalScore += result.score * framework.weight;
      totalWeight += framework.weight;
      
      this.displayFrameworkResult(framework, result);
    }

    this.results.overall_compliance = totalScore / totalWeight;
    this.results.status = this.determineComplianceStatus();
    
    this.displaySummary();
    this.generateRecommendations();
    
    return this.results;
  }

  async checkFrameworkCompliance(framework) {
    try {
      switch (framework.id) {
        case 'GDPR':
          return await this.checkGDPRCompliance();
        case 'SOX':
          return await this.checkSOXCompliance();
        case 'ISO27001':
          return await this.checkISO27001Compliance();
        case 'NIST_CSF':
          return await this.checkNISTCSFCompliance();
        case 'PCI_DSS':
          return await this.checkPCIDSSCompliance();
        case 'CCPA':
          return await this.checkCCPACompliance();
        default:
          return { score: 0, status: 'NOT_IMPLEMENTED', details: {} };
      }
    } catch (error) {
      return {
        score: 0,
        status: 'ERROR',
        details: { error: error.message }
      };
    }
  }

  async checkGDPRCompliance() {
    const checks = {
      data_protection_officer: this.checkFileExists('governance/privacy/dpo-designation.md'),
      privacy_policy: this.checkFileExists('docs/privacy-policy.md'),
      consent_management: this.checkCodePattern(/consent.*management/i),
      data_portability: this.checkCodePattern(/data.*export|portability/i),
      right_to_erasure: this.checkCodePattern(/delete.*user.*data|right.*erasure/i),
      breach_notification: this.checkCodePattern(/breach.*notification/i),
      privacy_by_design: this.checkCodePattern(/privacy.*by.*design/i),
      data_minimization: this.checkCodePattern(/data.*minimization/i)
    };

    const passedChecks = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;
    const score = (passedChecks / totalChecks) * 100;

    return {
      score: score,
      status: score >= 95 ? 'COMPLIANT' : score >= 80 ? 'MOSTLY_COMPLIANT' : 'NON_COMPLIANT',
      details: checks,
      passed: passedChecks,
      total: totalChecks
    };
  }

  async checkSOXCompliance() {
    const checks = {
      financial_controls: this.checkFileExists('governance/financial/internal-controls.md'),
      audit_trail: this.checkCodePattern(/audit.*trail|financial.*logging/i),
      segregation_of_duties: this.checkFileExists('governance/access/segregation-duties.md'),
      change_management: this.checkCodePattern(/change.*management.*process/i),
      data_retention: this.checkCodePattern(/data.*retention.*policy/i),
      access_controls: this.checkCodePattern(/role.*based.*access|rbac/i),
      documentation: this.checkFileExists('docs/sox-compliance.md'),
      management_certification: this.checkFileExists('governance/certifications/management-cert.md')
    };

    const passedChecks = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;
    const score = (passedChecks / totalChecks) * 100;

    return {
      score: score,
      status: score >= 95 ? 'COMPLIANT' : score >= 80 ? 'MOSTLY_COMPLIANT' : 'NON_COMPLIANT',
      details: checks,
      passed: passedChecks,
      total: totalChecks
    };
  }

  async checkISO27001Compliance() {
    const checks = {
      isms_policy: this.checkFileExists('governance/security/isms-policy.md'),
      risk_assessment: this.checkFileExists('governance/security/risk-assessment.md'),
      security_controls: this.checkCodePattern(/security.*controls.*implementation/i),
      incident_response: this.checkCodePattern(/incident.*response.*plan/i),
      business_continuity: this.checkFileExists('governance/continuity/bc-plan.md'),
      supplier_security: this.checkCodePattern(/supplier.*security.*assessment/i),
      security_training: this.checkFileExists('governance/training/security-training.md'),
      monitoring_review: this.checkCodePattern(/security.*monitoring.*review/i)
    };

    const passedChecks = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;
    const score = (passedChecks / totalChecks) * 100;

    return {
      score: score,
      status: score >= 90 ? 'COMPLIANT' : score >= 75 ? 'MOSTLY_COMPLIANT' : 'NON_COMPLIANT',
      details: checks,
      passed: passedChecks,
      total: totalChecks
    };
  }

  async checkNISTCSFCompliance() {
    const checks = {
      identify_function: this.checkCodePattern(/asset.*inventory|identify.*function/i),
      protect_function: this.checkCodePattern(/access.*control|protect.*function/i),
      detect_function: this.checkCodePattern(/anomaly.*detection|detect.*function/i),
      respond_function: this.checkCodePattern(/incident.*response|respond.*function/i),
      recover_function: this.checkCodePattern(/recovery.*plan|recover.*function/i),
      cybersecurity_framework: this.checkFileExists('governance/security/nist-csf-implementation.md'),
      risk_management: this.checkCodePattern(/risk.*management.*framework/i),
      supply_chain_security: this.checkCodePattern(/supply.*chain.*security/i)
    };

    const passedChecks = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;
    const score = (passedChecks / totalChecks) * 100;

    return {
      score: score,
      status: score >= 90 ? 'COMPLIANT' : score >= 75 ? 'MOSTLY_COMPLIANT' : 'NON_COMPLIANT',
      details: checks,
      passed: passedChecks,
      total: totalChecks
    };
  }

  async checkPCIDSSCompliance() {
    const checks = {
      secure_network: this.checkCodePattern(/firewall.*configuration|secure.*network/i),
      protect_cardholder_data: this.checkCodePattern(/encrypt.*cardholder|protect.*payment/i),
      vulnerability_management: this.checkCodePattern(/vulnerability.*scan|security.*patch/i),
      access_control: this.checkCodePattern(/unique.*user.*id|access.*control/i),
      monitor_networks: this.checkCodePattern(/network.*monitoring|log.*analysis/i),
      security_policy: this.checkFileExists('governance/security/pci-dss-policy.md'),
      regular_testing: this.checkCodePattern(/penetration.*test|security.*testing/i),
      information_security: this.checkCodePattern(/information.*security.*policy/i)
    };

    const passedChecks = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;
    const score = (passedChecks / totalChecks) * 100;

    return {
      score: score,
      status: score >= 100 ? 'COMPLIANT' : 'NON_COMPLIANT', // PCI DSS requires 100%
      details: checks,
      passed: passedChecks,
      total: totalChecks
    };
  }

  async checkCCPACompliance() {
    const checks = {
      privacy_notice: this.checkFileExists('docs/ccpa-privacy-notice.md'),
      consumer_rights: this.checkCodePattern(/consumer.*rights|ccpa.*rights/i),
      data_deletion: this.checkCodePattern(/delete.*personal.*data|data.*deletion/i),
      opt_out_mechanism: this.checkCodePattern(/opt.*out.*sale|do.*not.*sell/i),
      data_categories: this.checkCodePattern(/personal.*information.*categories/i),
      third_party_disclosure: this.checkCodePattern(/third.*party.*disclosure/i),
      non_discrimination: this.checkCodePattern(/non.*discrimination.*policy/i),
      verification_process: this.checkCodePattern(/identity.*verification|request.*verification/i)
    };

    const passedChecks = Object.values(checks).filter(Boolean).length;
    const totalChecks = Object.keys(checks).length;
    const score = (passedChecks / totalChecks) * 100;

    return {
      score: score,
      status: score >= 95 ? 'COMPLIANT' : score >= 80 ? 'MOSTLY_COMPLIANT' : 'NON_COMPLIANT',
      details: checks,
      passed: passedChecks,
      total: totalChecks
    };
  }

  checkFileExists(filePath) {
    return fs.existsSync(path.join(__dirname, '..', filePath));
  }

  checkCodePattern(pattern) {
    try {
      // Search through governance files for pattern
      const governanceDir = path.join(__dirname, '../governance');
      if (!fs.existsSync(governanceDir)) return false;
      
      const files = this.getAllFiles(governanceDir, ['.js', '.ts', '.md']);
      
      for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        if (pattern.test(content)) return true;
      }
      
      return false;
    } catch (error) {
      return false;
    }
  }

  getAllFiles(dir, extensions) {
    const files = [];
    
    function traverse(currentDir) {
      const items = fs.readdirSync(currentDir);
      
      for (const item of items) {
        const fullPath = path.join(currentDir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory()) {
          traverse(fullPath);
        } else if (extensions.some(ext => item.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    }
    
    if (fs.existsSync(dir)) {
      traverse(dir);
    }
    
    return files;
  }

  displayFrameworkResult(framework, result) {
    const statusIcon = result.status === 'COMPLIANT' ? '✅' : 
                      result.status === 'MOSTLY_COMPLIANT' ? '⚠️' : '❌';
    const statusColor = result.status === 'COMPLIANT' ? 'green' : 
                       result.status === 'MOSTLY_COMPLIANT' ? 'yellow' : 'red';
    
    console.log(
      `${statusIcon} ${framework.id}: ${chalk[statusColor](framework.name)} ` +
      `(${result.score.toFixed(1)}%) - ${result.passed}/${result.total} checks passed`
    );
  }

  determineComplianceStatus() {
    if (this.results.overall_compliance >= 95) return 'FULLY_COMPLIANT';
    if (this.results.overall_compliance >= 85) return 'MOSTLY_COMPLIANT';
    if (this.results.overall_compliance >= 70) return 'PARTIALLY_COMPLIANT';
    return 'NON_COMPLIANT';
  }

  displaySummary() {
    console.log('\n' + '='.repeat(80));
    console.log(chalk.bold.blue('📊 COMPLIANCE VALIDATION SUMMARY'));
    console.log('='.repeat(80));
    
    console.log(`📋 Frameworks Checked: ${this.frameworks.length}`);
    console.log(`📈 Overall Compliance: ${this.results.overall_compliance.toFixed(1)}%`);
    console.log(`🎯 Compliance Status: ${chalk.bold(this.getStatusColor(this.results.status))}`);
    
    console.log('\n📊 Framework Breakdown:');
    for (const framework of this.frameworks) {
      const result = this.results.frameworks[framework.id];
      console.log(`   • ${framework.id}: ${result.score.toFixed(1)}% (${result.status})`);
    }
  }

  getStatusColor(status) {
    const colors = {
      'FULLY_COMPLIANT': chalk.green(status),
      'MOSTLY_COMPLIANT': chalk.blue(status),
      'PARTIALLY_COMPLIANT': chalk.yellow(status),
      'NON_COMPLIANT': chalk.red(status)
    };
    return colors[status] || status;
  }

  generateRecommendations() {
    console.log('\n💡 COMPLIANCE RECOMMENDATIONS:');
    
    if (this.results.overall_compliance >= 95) {
      console.log(chalk.green('   ✨ Excellent compliance posture!'));
      console.log(chalk.green('   🔄 Continue regular compliance monitoring.'));
    } else {
      console.log(chalk.yellow('   ⚠️  Compliance gaps identified.'));
      console.log(chalk.yellow('   📋 Review failed checks and implement missing controls.'));
      console.log(chalk.yellow('   📚 Consider compliance training for development teams.'));
    }
  }

  async saveResults() {
    const resultsPath = path.join(__dirname, '../governance-reports/compliance-results.json');
    
    const dir = path.dirname(resultsPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(resultsPath, JSON.stringify(this.results, null, 2));
    console.log(`\n📄 Results saved to: ${resultsPath}`);
  }
}

// Main execution
async function main() {
  try {
    const checker = new ComplianceChecker();
    const results = await checker.checkAllCompliance();
    await checker.saveResults();
    
    const exitCode = results.status === 'NON_COMPLIANT' ? 1 : 0;
    process.exit(exitCode);
    
  } catch (error) {
    console.error(chalk.red('❌ Compliance check failed:'), error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = ComplianceChecker; 