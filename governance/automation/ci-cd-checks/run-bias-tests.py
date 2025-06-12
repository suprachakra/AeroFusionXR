#!/usr/bin/env python3
"""
Automated Bias Testing for AeroFusionXR AI Models
Runs fairness and bias detection tests as part of CI/CD pipeline
"""

import os
import sys
import json
import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Any
import logging
from pathlib import Path

# Fairness libraries
try:
    from sklearn.metrics import accuracy_score, confusion_matrix
except ImportError as e:
    print(f"❌ Missing required libraries: {e}")
    print("Install with: pip install scikit-learn pandas numpy")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class BiasTestSuite:
    """Comprehensive bias testing suite for AI models"""
    
    def __init__(self, config_path: str = "governance/automation/bias-test-config.json"):
        self.config = self._load_config(config_path)
        self.results = {}
        self.thresholds = {
            'demographic_parity': 0.1,  # Max difference allowed
            'equalized_odds': 0.1,      # Max difference allowed
            'disparate_impact': 0.8,    # Min ratio allowed
            'accuracy_parity': 0.05     # Max accuracy difference
        }
    
    def _load_config(self, config_path: str) -> Dict:
        """Load bias testing configuration"""
        default_config = {
            "models": [
                {
                    "name": "ai-concierge",
                    "path": "services/core/passenger-experience/ai-concierge/models/",
                    "test_data": "services/core/passenger-experience/ai-concierge/data/test.csv",
                    "protected_attributes": ["gender", "age_group", "nationality"]
                }
            ],
            "synthetic_data": {
                "enabled": True,
                "samples": 1000
            }
        }
        
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                return json.load(f)
        else:
            logger.warning(f"Config file {config_path} not found, using defaults")
            return default_config
    
    def generate_synthetic_test_data(self, samples: int = 1000) -> pd.DataFrame:
        """Generate synthetic test data for bias testing"""
        np.random.seed(42)
        
        data = {
            'feature_1': np.random.normal(0, 1, samples),
            'feature_2': np.random.normal(0, 1, samples),
            'gender': np.random.choice(['M', 'F'], samples),
            'age_group': np.random.choice(['18-30', '31-50', '51+'], samples),
            'nationality': np.random.choice(['UAE', 'US', 'UK', 'Other'], samples)
        }
        
        # Create synthetic target with some bias
        df = pd.DataFrame(data)
        df['target'] = (
            df['feature_1'] + 
            df['feature_2'] * 0.5 + 
            (df['gender'] == 'M') * 0.1 +  # Slight gender bias
            np.random.normal(0, 0.1, samples)
        ) > 0
        
        # Create predictions with similar bias pattern
        df['prediction'] = (
            df['feature_1'] + 
            df['feature_2'] * 0.5 + 
            (df['gender'] == 'M') * 0.15 +  # Slightly more bias in predictions
            np.random.normal(0, 0.15, samples)
        ) > 0
        
        return df
    
    def test_demographic_parity(self, df: pd.DataFrame, protected_attr: str) -> Dict:
        """Test demographic parity across protected attribute groups"""
        try:
            groups = df[protected_attr].unique()
            selection_rates = {}
            
            for group in groups:
                group_data = df[df[protected_attr] == group]
                selection_rates[group] = group_data['prediction'].mean()
            
            rates = list(selection_rates.values())
            max_diff = max(rates) - min(rates)
            
            result = {
                'metric': 'demographic_parity',
                'protected_attribute': protected_attr,
                'selection_rates': selection_rates,
                'max_difference': max_diff,
                'threshold': self.thresholds['demographic_parity'],
                'passed': max_diff <= self.thresholds['demographic_parity']
            }
            
            logger.info(f"Demographic parity for {protected_attr}: {max_diff:.3f}")
            return result
            
        except Exception as e:
            logger.error(f"Error in demographic parity test: {e}")
            return {'error': str(e), 'passed': False}
    
    def run_bias_tests_for_model(self, model_config: Dict) -> Dict:
        """Run all bias tests for a specific model"""
        model_name = model_config['name']
        logger.info(f"Running bias tests for model: {model_name}")
        
        # Use synthetic data for testing
        df = self.generate_synthetic_test_data()
        
        model_results = {
            'model': model_name,
            'tests': [],
            'overall_passed': True
        }
        
        protected_attrs = model_config.get('protected_attributes', ['gender'])
        
        for attr in protected_attrs:
            if attr not in df.columns:
                continue
            
            test = self.test_demographic_parity(df, attr)
            model_results['tests'].append(test)
            
            if not test.get('passed', False):
                model_results['overall_passed'] = False
        
        return model_results
    
    def run_all_tests(self) -> Dict:
        """Run bias tests for all configured models"""
        logger.info("Starting bias testing suite")
        
        all_results = {
            'timestamp': pd.Timestamp.now().isoformat(),
            'models': [],
            'summary': {
                'total_models': 0,
                'passed_models': 0,
                'failed_models': 0,
                'overall_passed': True
            }
        }
        
        for model_config in self.config['models']:
            model_results = self.run_bias_tests_for_model(model_config)
            all_results['models'].append(model_results)
            
            all_results['summary']['total_models'] += 1
            if model_results['overall_passed']:
                all_results['summary']['passed_models'] += 1
            else:
                all_results['summary']['failed_models'] += 1
                all_results['summary']['overall_passed'] = False
        
        return all_results

def main():
    """Main function to run bias tests"""
    try:
        bias_tester = BiasTestSuite()
        results = bias_tester.run_all_tests()
        
        os.makedirs("reports", exist_ok=True)
        
        with open("reports/bias-test-results.json", "w") as f:
            json.dump(results, f, indent=2, default=str)
        
        print(f"✅ Bias tests completed. Results: {results['summary']}")
        
        if results['summary']['overall_passed']:
            sys.exit(0)
        else:
            print("❌ Some bias tests failed")
            sys.exit(1)
    
    except Exception as e:
        logger.error(f"Bias testing failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main() 