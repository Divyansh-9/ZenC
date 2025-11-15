# Phase 4 ML Training Report

- Dataset score: 10.00
- Model score: 9.38
- LSTM score: n/a

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

      benign       0.82      0.90      0.86        10
   malicious       1.00      1.00      1.00        10
     unknown       0.75      0.60      0.67         5

    accuracy                           0.88        25
   macro avg       0.86      0.83      0.84        25
weighted avg       0.88      0.88      0.88        25

```

## Feature Importances
- violation_count: 0.1880
- threads_mean: 0.1842
- open_files_mean: 0.0990
- cpu_max: 0.0908
- cpu_std: 0.0691
- io_write_rate: 0.0593
- io_read_rate: 0.0525
- socket_count_mean: 0.0470
- duration_seconds: 0.0389
- rss_mean: 0.0333
- rss_std: 0.0299
- time_above_cpu_50: 0.0275
- rss_slope: 0.0253
- cpu_slope: 0.0201
- cpu_mean: 0.0200
- rss_max: 0.0152