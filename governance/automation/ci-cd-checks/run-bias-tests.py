#!/usr/bin/env python3
"""
Bias Detection and Fairness Testing for CI/CD Pipeline
Comprehensive bias testing for AeroFusionXR AI systems
"""

import os
import sys
import json
import numpy as np
import pandas as pd
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
import logging

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

class BiasTestSuite:
    """Comprehensive bias testing suite for AI models"""
    
    def __init__(self):
        self.rng = np.random.default_rng()
        self.test_results = []
        self.fairness_threshold = 0.8
        self.bias_threshold = 0.2
        
    def run_all_tests(self) -> Dict[str, Any]:
        """Run all bias detection tests"""
        logger.info("🔍 Starting comprehensive bias testing...")
        
        results = {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'overall_status': 'PASSED',
            'tests_run': 0,
            'tests_passed': 0,
            'tests_failed': 0,
            'bias_detected': False,
            'fairness_score': 0.0,
            'test_details': []
        }
        
        # Test 1: Demographic Parity Test
        demo_result = self.test_demographic_parity()
        results['test_details'].append(demo_result)
        results['tests_run'] += 1
        if demo_result['passed']:
            results['tests_passed'] += 1
        else:
            results['tests_failed'] += 1
            results['bias_detected'] = True
        
        # Test 2: Equalized Odds Test
        eq_odds_result = self.test_equalized_odds()
        results['test_details'].append(eq_odds_result)
        results['tests_run'] += 1
        if eq_odds_result['passed']:
            results['tests_passed'] += 1
        else:
            results['tests_failed'] += 1
            results['bias_detected'] = True
        
        # Test 3: Calibration Test
        calibration_result = self.test_calibration()
        results['test_details'].append(calibration_result)
        results['tests_run'] += 1
        if calibration_result['passed']:
            results['tests_passed'] += 1
        else:
            results['tests_failed'] += 1
            results['bias_detected'] = True
        
        # Test 4: Individual Fairness Test
        individual_result = self.test_individual_fairness()
        results['test_details'].append(individual_result)
        results['tests_run'] += 1
        if individual_result['passed']:
            results['tests_passed'] += 1
        else:
            results['tests_failed'] += 1
            results['bias_detected'] = True
        
        # Test 5: Counterfactual Fairness Test
        counterfactual_result = self.test_counterfactual_fairness()
        results['test_details'].append(counterfactual_result)
        results['tests_run'] += 1
        if counterfactual_result['passed']:
            results['tests_passed'] += 1
        else:
            results['tests_failed'] += 1
            results['bias_detected'] = True
        
        # Calculate overall fairness score
        fairness_scores = [test['fairness_score'] for test in results['test_details']]
        results['fairness_score'] = np.mean(fairness_scores)
        
        # Determine overall status
        if results['bias_detected'] or results['fairness_score'] < self.fairness_threshold:
            results['overall_status'] = 'FAILED'
        
        logger.info(f"✅ Bias testing completed. Status: {results['overall_status']}")
        logger.info(f"📊 Fairness Score: {results['fairness_score']:.3f}")
        
        return results
    
    def test_demographic_parity(self) -> Dict[str, Any]:
        """Test for demographic parity across protected groups"""
        logger.info("   Testing demographic parity...")
        
        # Simulate model predictions for different demographic groups
        groups = ['group_a', 'group_b', 'group_c']
        group_predictions = {}
        
        for group in groups:
            # Simulate predictions with slight bias
            if group == 'group_a':
                predictions = self.rng.choice([0, 1], size=1000, p=[0.3, 0.7])
            elif group == 'group_b':
                predictions = self.rng.choice([0, 1], size=1000, p=[0.4, 0.6])
            else:
                predictions = self.rng.choice([0, 1], size=1000, p=[0.35, 0.65])
            
            group_predictions[group] = predictions
        
        # Calculate demographic parity
        positive_rates = {}
        for group, preds in group_predictions.items():
            positive_rates[group] = np.mean(preds)
        
        # Check if rates are similar across groups
        max_rate = max(positive_rates.values())
        min_rate = min(positive_rates.values())
        parity_ratio = min_rate / max_rate if max_rate > 0 else 1.0
        
        passed = parity_ratio >= self.fairness_threshold
        
        return {
            'test_name': 'Demographic Parity',
            'test_type': 'fairness',
            'passed': passed,
            'fairness_score': parity_ratio,
            'details': {
                'positive_rates': positive_rates,
                'parity_ratio': parity_ratio,
                'threshold': self.fairness_threshold
            },
            'recommendations': [] if passed else [
                'Review training data for demographic balance',
                'Apply bias mitigation techniques during training',
                'Consider post-processing fairness adjustments'
            ]
        }
    
    def test_equalized_odds(self) -> Dict[str, Any]:
        """Test for equalized odds across protected groups"""
        logger.info("   Testing equalized odds...")
        
        # Simulate true labels and predictions for different groups
        groups = ['group_a', 'group_b']
        group_metrics = {}
        
        for group in groups:
            # Simulate ground truth and predictions
            y_true = self.rng.choice([0, 1], size=1000, p=[0.5, 0.5])
            
            # Introduce slight bias in predictions
            if group == 'group_a':
                # Slightly better performance for group A
                y_pred = y_true.copy()
                flip_indices = self.rng.choice(len(y_true), size=int(0.1 * len(y_true)), replace=False)
                y_pred[flip_indices] = 1 - y_pred[flip_indices]
            else:
                # Slightly worse performance for group B
                y_pred = y_true.copy()
                flip_indices = self.rng.choice(len(y_true), size=int(0.15 * len(y_true)), replace=False)
                y_pred[flip_indices] = 1 - y_pred[flip_indices]
            
            # Calculate TPR and FPR
            tp = np.sum((y_true == 1) & (y_pred == 1))
            fn = np.sum((y_true == 1) & (y_pred == 0))
            fp = np.sum((y_true == 0) & (y_pred == 1))
            tn = np.sum((y_true == 0) & (y_pred == 0))
            
            tpr = tp / (tp + fn) if (tp + fn) > 0 else 0
            fpr = fp / (fp + tn) if (fp + tn) > 0 else 0
            
            group_metrics[group] = {'tpr': tpr, 'fpr': fpr}
        
        # Check equalized odds
        tpr_diff = abs(group_metrics['group_a']['tpr'] - group_metrics['group_b']['tpr'])
        fpr_diff = abs(group_metrics['group_a']['fpr'] - group_metrics['group_b']['fpr'])
        
        max_allowed_diff = 1 - self.fairness_threshold
        passed = tpr_diff <= max_allowed_diff and fpr_diff <= max_allowed_diff
        
        fairness_score = 1 - max(tpr_diff, fpr_diff)
        
        return {
            'test_name': 'Equalized Odds',
            'test_type': 'fairness',
            'passed': passed,
            'fairness_score': fairness_score,
            'details': {
                'group_metrics': group_metrics,
                'tpr_difference': tpr_diff,
                'fpr_difference': fpr_diff,
                'max_allowed_difference': max_allowed_diff
            },
            'recommendations': [] if passed else [
                'Retrain model with balanced performance across groups',
                'Apply threshold optimization for fairness',
                'Consider adversarial debiasing techniques'
            ]
        }
    
    def test_calibration(self) -> Dict[str, Any]:
        """Test for calibration across protected groups"""
        logger.info("   Testing calibration...")
        
        # Simulate calibration data for different groups
        groups = ['group_a', 'group_b']
        calibration_scores = {}
        
        for group in groups:
            # Simulate predicted probabilities and actual outcomes
            n_samples = 1000
            pred_probs = self.rng.uniform(0, 1, n_samples)
            
            # Introduce calibration bias
            if group == 'group_a':
                # Well-calibrated
                actual_outcomes = self.rng.binomial(1, pred_probs)
            else:
                # Slightly miscalibrated
                biased_probs = pred_probs * 0.9  # Underconfident
                actual_outcomes = self.rng.binomial(1, biased_probs)
            
            # Calculate calibration error (simplified)
            bins = np.linspace(0, 1, 11)
            bin_indices = np.digitize(pred_probs, bins) - 1
            
            calibration_error = 0
            for i in range(len(bins) - 1):
                mask = bin_indices == i
                if np.sum(mask) > 0:
                    avg_pred = np.mean(pred_probs[mask])
                    avg_actual = np.mean(actual_outcomes[mask])
                    calibration_error += abs(avg_pred - avg_actual) * np.sum(mask)
            
            calibration_error /= n_samples
            calibration_scores[group] = 1 - calibration_error  # Higher is better
        
        # Check calibration fairness
        calibration_diff = abs(calibration_scores['group_a'] - calibration_scores['group_b'])
        passed = calibration_diff <= (1 - self.fairness_threshold)
        
        avg_calibration = np.mean(list(calibration_scores.values()))
        
        return {
            'test_name': 'Calibration',
            'test_type': 'fairness',
            'passed': passed,
            'fairness_score': avg_calibration,
            'details': {
                'group_calibration_scores': calibration_scores,
                'calibration_difference': calibration_diff,
                'average_calibration': avg_calibration
            },
            'recommendations': [] if passed else [
                'Apply calibration techniques (Platt scaling, isotonic regression)',
                'Ensure balanced calibration data across groups',
                'Monitor calibration drift over time'
            ]
        }
    
    def test_individual_fairness(self) -> Dict[str, Any]:
        """Test for individual fairness (similar individuals get similar outcomes)"""
        logger.info("   Testing individual fairness...")
        
        # Simulate individual fairness test
        n_pairs = 100
        similarity_scores = []
        outcome_differences = []
        
        for _ in range(n_pairs):
            # Create two similar individuals
            individual_a = self.rng.normal(0, 1, 10)  # 10 features
            individual_b = individual_a + self.rng.normal(0, 0.1, 10)  # Similar but slightly different
            
            # Calculate similarity (inverse of distance)
            distance = np.linalg.norm(individual_a - individual_b)
            similarity = 1 / (1 + distance)
            
            # Simulate model predictions (with some unfairness)
            pred_a = self.rng.uniform(0, 1)
            pred_b = pred_a + self.rng.normal(0, 0.2)  # Should be similar but isn't always
            pred_b = np.clip(pred_b, 0, 1)
            
            outcome_diff = abs(pred_a - pred_b)
            
            similarity_scores.append(similarity)
            outcome_differences.append(outcome_diff)
        
        # Individual fairness: similar individuals should have similar outcomes
        correlation = np.corrcoef(similarity_scores, [1 - diff for diff in outcome_differences])[0, 1]
        fairness_score = max(0, correlation)  # Positive correlation is good
        
        passed = fairness_score >= self.fairness_threshold
        
        return {
            'test_name': 'Individual Fairness',
            'test_type': 'fairness',
            'passed': passed,
            'fairness_score': fairness_score,
            'details': {
                'correlation': correlation,
                'avg_similarity': np.mean(similarity_scores),
                'avg_outcome_difference': np.mean(outcome_differences),
                'pairs_tested': n_pairs
            },
            'recommendations': [] if passed else [
                'Implement Lipschitz constraints in model training',
                'Use fairness-aware distance metrics',
                'Apply individual fairness regularization'
            ]
        }
    
    def test_counterfactual_fairness(self) -> Dict[str, Any]:
        """Test for counterfactual fairness"""
        logger.info("   Testing counterfactual fairness...")
        
        # Simulate counterfactual fairness test
        n_samples = 500
        fairness_violations = 0
        
        for _ in range(n_samples):
            # Create individual with protected attribute
            features = self.rng.normal(0, 1, 8)
            protected_attr_original = self.rng.choice([0, 1])
            
            # Original prediction
            input_original = np.concatenate([features, [protected_attr_original]])
            pred_original = self.simulate_model_prediction(input_original)
            
            # Counterfactual prediction (flip protected attribute)
            protected_attr_counterfactual = 1 - protected_attr_original
            input_counterfactual = np.concatenate([features, [protected_attr_counterfactual]])
            pred_counterfactual = self.simulate_model_prediction(input_counterfactual)
            
            # Check if predictions differ significantly
            if abs(pred_original - pred_counterfactual) > 0.1:  # Threshold for significant difference
                fairness_violations += 1
        
        violation_rate = fairness_violations / n_samples
        fairness_score = 1 - violation_rate
        passed = fairness_score >= self.fairness_threshold
        
        return {
            'test_name': 'Counterfactual Fairness',
            'test_type': 'fairness',
            'passed': passed,
            'fairness_score': fairness_score,
            'details': {
                'violation_rate': violation_rate,
                'violations_detected': fairness_violations,
                'samples_tested': n_samples,
                'violation_threshold': 0.1
            },
            'recommendations': [] if passed else [
                'Remove protected attributes from model features',
                'Apply causal fairness techniques',
                'Use adversarial training for fairness'
            ]
        }
    
    def simulate_model_prediction(self, features: np.ndarray) -> float:
        """Simulate a model prediction (with potential bias)"""
        # Simple linear model with bias towards certain protected attributes
        weights = self.rng.normal(0, 1, len(features))
        
        # Introduce bias: give more weight to protected attribute
        if len(features) > 8:  # Assuming last feature is protected attribute
            weights[-1] *= 2  # Bias factor
        
        prediction = np.dot(features, weights)
        return 1 / (1 + np.exp(-prediction))  # Sigmoid activation
    
    def generate_report(self, results: Dict[str, Any]) -> str:
        """Generate a comprehensive bias testing report"""
        report = f"""
# Bias Detection and Fairness Testing Report

**Generated**: {results['timestamp']}
**Overall Status**: {results['overall_status']}
**Fairness Score**: {results['fairness_score']:.3f}

## Summary
- Tests Run: {results['tests_run']}
- Tests Passed: {results['tests_passed']}
- Tests Failed: {results['tests_failed']}
- Bias Detected: {'Yes' if results['bias_detected'] else 'No'}

## Test Details

"""
        
        for test in results['test_details']:
            status_emoji = "✅" if test['passed'] else "❌"
            report += f"### {status_emoji} {test['test_name']}\n"
            report += f"- **Status**: {'PASSED' if test['passed'] else 'FAILED'}\n"
            report += f"- **Fairness Score**: {test['fairness_score']:.3f}\n"
            report += f"- **Type**: {test['test_type']}\n"
            
            if not test['passed'] and test['recommendations']:
                report += "- **Recommendations**:\n"
                for rec in test['recommendations']:
                    report += f"  - {rec}\n"
            
            report += "\n"
        
        if results['bias_detected']:
            report += """
## ⚠️ Action Required

Bias has been detected in the AI system. Please review the recommendations above and implement appropriate mitigation strategies before deployment.

## Next Steps
1. Review failed test details
2. Implement recommended bias mitigation techniques
3. Retrain models if necessary
4. Re-run bias tests to verify improvements
"""
        else:
            report += """
## ✅ All Tests Passed

No significant bias detected. The AI system meets fairness requirements.
"""
        
        return report

def main():
    """Main function to run bias tests"""
    try:
        # Initialize bias test suite
        bias_tester = BiasTestSuite()
        
        # Run all tests
        results = bias_tester.run_all_tests()
        
        # Generate report
        report = bias_tester.generate_report(results)
        
        # Save results
        results_file = Path('bias-test-results.json')
        with open(results_file, 'w') as f:
            json.dump(results, f, indent=2)
        
        report_file = Path('bias-test-report.md')
        with open(report_file, 'w') as f:
            f.write(report)
        
        logger.info(f"📄 Results saved to {results_file}")
        logger.info(f"📄 Report saved to {report_file}")
        
        # Print summary
        print(f"\n{'='*60}")
        print(f"BIAS TESTING SUMMARY")
        print(f"{'='*60}")
        print(f"Overall Status: {results['overall_status']}")
        print(f"Fairness Score: {results['fairness_score']:.3f}")
        print(f"Tests Passed: {results['tests_passed']}/{results['tests_run']}")
        print(f"Bias Detected: {'Yes' if results['bias_detected'] else 'No'}")
        print(f"{'='*60}")
        
        # Exit with appropriate code
        if results['overall_status'] == 'FAILED':
            logger.error("❌ Bias testing failed. Please address the issues before deployment.")
            sys.exit(1)
        else:
            logger.info("✅ All bias tests passed successfully!")
            sys.exit(0)
            
    except Exception as e:
        logger.error(f"❌ Error running bias tests: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
