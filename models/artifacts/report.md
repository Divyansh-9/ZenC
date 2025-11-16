# Phase 4 ML Training Report

- Dataset score: 10.00
- Model score: 9.44
- LSTM score: 10.0

## Dataset Metrics
- **variance_mean**: 10539318044863950.0000
- **balance_ratio**: 0.5417
- **time_std**: 23.0757
- **anomaly_ratio**: 0.4262
- **rare_total**: 18.0000
- **sample_count**: 61.0000

## Class Counts
- unknown: 13
- benign: 24
- malicious: 24

## Random Forest Evaluation
```
              precision    recall  f1-score   support

      benign       0.75      1.00      0.86         6
   malicious       1.00      1.00      1.00         6
     unknown       1.00      0.50      0.67         4

    accuracy                           0.88        16
   macro avg       0.92      0.83      0.84        16
weighted avg       0.91      0.88      0.86        16

```

## Feature Importances
- threads_mean: 0.2317
- violation_count: 0.1688
- cpu_std: 0.0839
- cpu_max: 0.0823
- open_files_mean: 0.0661
- io_read_rate: 0.0610
- io_write_rate: 0.0397
- duration_seconds: 0.0393
- socket_count_mean: 0.0385
- time_above_cpu_50: 0.0344
- rss_max: 0.0333
- cpu_mean: 0.0294
- rss_mean: 0.0264
- rss_std: 0.0226
- cpu_slope: 0.0226
- rss_slope: 0.0203