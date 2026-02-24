# LECTOR: LLM-Enhanced Concept-based Test-Oriented Repetition for Adaptive Spaced Learning

Source: arxiv.org/abs/2508.03275
Author: Jiahao Zhao (Xi'an University of Posts and Telecommunications)
Funding: Shenzhen Smartlink Technology Co., Ltd (Grant SLAI20241006), Tencent T-Spark Program

---

## Abstract

Spaced repetition systems are fundamental to efficient learning and memory retention,
but existing algorithms often struggle with semantic interference and personalized
adaptation. LECTOR is a novel adaptive scheduling algorithm designed for test-oriented
learning, particularly language examinations where success rates matter most. The system
leverages large language models for semantic analysis combined with personalized learning
profiles, addressing semantic confusion in vocabulary learning through LLM-powered
semantic similarity assessment integrated with spaced repetition principles.

Result: 90.2% success rate versus 88.4% for the best baseline (SSP-MMC), a 2.0%
relative improvement across 100 simulated learners over 100 days.


## 1. Introduction

Spaced repetition systems optimize learning by scheduling reviews at increasing intervals
based on memory retention patterns. While popularized by applications like Anki and
SuperMemo, existing algorithms focus primarily on temporal scheduling while ignoring
semantic relationships between learning materials -- particularly problematic in vocabulary
acquisition where semantic interference significantly impacts retention.

Traditional algorithms (SM2, HLR, FSRS) treat each item in isolation, failing to account
for semantic similarity between concepts. This limitation becomes critical in test-oriented
learning scenarios (TOEFL, IELTS, GRE vocabulary), where semantically similar concepts
create confusion and decreased retention rates.

Recent advances in large language models and In-Context Learning present opportunities to
address these limitations. LLMs can assess semantic relationships through few-shot learning
without parameter updates, enabling nuanced similarity assessments beyond surface-level
features.

LECTOR introduces three key innovations optimized for examination scenarios:

1. Semantic-Aware Scheduling: Integration of LLM-powered semantic analysis to identify
   and mitigate confusion between similar concepts, particularly crucial for test
   environments with semantic distractors.

2. Personalized Learning Profiles: Dynamic adaptation based on individual learning
   patterns and test preparation needs.

3. Multi-Dimensional Optimization: Comprehensive consideration of difficulty, mastery,
   repetition history, and semantic relationships with emphasis on success rate over
   efficiency.


## 2. Related Work

### 2.1 Classical Spaced Repetition Algorithms

Spaced repetition traces to Hermann Ebbinghaus's forgetting curve research, which
established the theoretical basis for spaced learning. The SuperMemo 2 (SM2) algorithm
introduced ease factors and adaptive interval calculation, while Half-Life Regression (HLR)
advanced the field through probabilistic modeling of memory decay.

Recent algorithms like FSRS and SSP-MMC represent state-of-the-art approaches. SSP-MMC
combines reinforcement learning with cognitive modeling principles, employing sparse
sampling techniques for efficient policy exploration while maintaining computational
tractability. However, these approaches do not explicitly model semantic relationships
between learning concepts.

### 2.2 Cognitive Science and Adaptive Learning Foundations

Research in cognitive psychology has established the testing effect and spacing effect as
fundamental principles underlying effective learning. The field has advanced through
knowledge tracing approaches and Deep Knowledge Tracing, which model learner understanding
over time using neural networks.

Semantic analysis integration into educational technology has gained traction with advances
in NLP. Word embeddings and transformer models like BERT enable sophisticated understanding
of semantic relationships. However, the application of semantic analysis to spaced
repetition scheduling remains largely unexplored.

### 2.3 Large Language Models and In-Context Learning

The emergence of powerful LLMs has opened new possibilities for educational applications.
In-Context Learning (ICL) -- where language models make predictions based on contexts
augmented with few examples, without parameter updates -- proves particularly relevant.

In LECTOR, ICL provides the theoretical foundation for semantic analysis. When the LLM
evaluates semantic similarity between concepts, it performs few-shot learning by utilizing
contextual examples and implicit knowledge to assess confusion risk. This approach
leverages emergent abilities of large language models without requiring task-specific
fine-tuning.


## 3. Methodology

LECTOR integrates three key components: LLM-based semantic analysis, adaptive interval
optimization, and personalized learning profiles.

For each learner-concept pair (l_i, c_j), the learning state vector at time t:

```
S_{i,j}(t) = (d_{i,j}, h_{i,j}(t), p_{i,j}(t), u_{i,j}(t), o_{i,j}(t))  in R^5
```

Where:
- `d` = concept difficulty (static)
- `h` = memory half-life at time t
- `p` = repetition count
- `u` = mastery level
- `o` = semantic interference factor

### 3.1 LLM-Based Semantic Analysis

Semantic similarity function:

```
Phi(c_i, c_j) = LLM(pi_semantic(c_i, c_j))
```

Where `pi_semantic` constructs a standardized prompt instructing the LLM to evaluate
confusion risk between concept pairs.

Semantic interference matrix `S in [0,1]^{n x n}`:

```
S_{i,j} = Phi(c_i, c_j)   if i != j
S_{i,j} = 0                if i = j
```

### 3.2 Adaptive Interval Optimization

Core forgetting curve with semantic interference:

```
R_{i,j}(t + dt) = exp(-dt / (tau_{i,j}(t) * alpha_{i,j}(t) * beta_i(t)))
```

Where:
- `tau` = mastery-scaled half-life
- `alpha` = semantic interference modulation
- `beta` = per-learner personalization factor

Final interval calculation:

```
I*_{i,j}(t) = I_base(t) * prod_{k=1}^{4} F_k(S_{i,j}(t), profile_i(t))
```

Where adjustment factors F_k include:
1. Semantic awareness adjustment
2. Mastery level scaling
3. Repetition history weighting
4. Personal learning characteristics

### 3.3 Personalized Learning Profiles

Learner profile (4D vector):

```
profile_i(t) = [
    success_rate_i(t),
    learning_speed_i(t),
    retention_i(t),
    semantic_sensitivity_i(t)
]
```

Update rule (exponential moving average):

```
profile_i(t+1) = (1 - lambda) * profile_i(t) + lambda * recent_metrics_i(t)
```

Where `lambda in [0,1]` controls adaptation speed.


## 4. Experimental Setup

### 4.1 Dataset and Simulation Environment

- Student Population: 100 simulated learners with varied learning profiles
- Learning Duration: 100-day simulation period
- Concept Pool: 50 semantic groups with internally similar concepts
- Concepts per Learner: 25 items

### 4.2 Baseline Algorithms

1. SSP-MMC: Sparse-Sampling Plus Memory-Mixture Coordination
2. SM2: SuperMemo 2 Classic Algorithm
3. HLR: Half-Life Regression Algorithm
4. FSRS: Free Spaced Repetition Scheduler
5. ANKI: Anki Default Algorithm
6. THRESHOLD: Threshold-based Algorithm

### 4.3 Evaluation Metrics

- Success Rate: Proportion of successful recall attempts
- Efficiency Score: Success rate weighted by average interval
- Learning Burden: Total number of review attempts required
- Average Interval: Mean time between reviews

### 4.4 Computational Resources

Simulation experiments have relatively modest computational requirements, with execution
time scaling linearly with experimental data size. The semantic analysis is precomputed;
the scheduling loop itself is lightweight.


## 5. Results

### 5.1 Overall Performance Comparison

| Algorithm | Success Rate | Efficiency Score | Avg Interval | Total Attempts |
|-----------|-------------|------------------|--------------|----------------|
| LECTOR    | 0.902       | 3.73             | 5.20         | 50,706         |
| FSRS      | 0.896       | 1.22             | 1.70         | 151,848        |
| SSP-MMC   | 0.884       | 4.42             | 6.25         | 42,743         |
| THRESHOLD | 0.847       | 8.73             | 12.88        | 25,012         |
| HLR       | 0.766       | 13.66            | 22.29        | 18,849         |
| ANKI      | 0.605       | 8.59             | 17.75        | 19,033         |
| SM2       | 0.471       | 7.08             | 18.81        | 18,611         |

### 5.2 Success Rate Analysis

Three distinct performance tiers:

- High-performing (>88%): LECTOR 90.2%, FSRS 89.6%, SSP-MMC 88.4%
- Moderate (76-85%): THRESHOLD 84.7%, HLR 76.6%
- Lower (<61%): ANKI 60.5%, SM2 47.1%

LECTOR's 1.8 percentage point improvement over SSP-MMC represents a statistically
significant advancement. The superior performance demonstrates the value of
semantic-aware scheduling in addressing conceptual confusion.

### 5.3 Performance Analysis and Trade-offs

LECTOR processes 50,706 semantic enhancements (100% coverage). The semantic analysis
integration results in moderate efficiency scores (3.73) and higher learning burden
compared to most baselines, demonstrating intentional focus on maximizing success rate
for test preparation scenarios rather than optimizing computational efficiency.

FSRS achieves near-identical success rate (89.6%) but at 3x the review cost (151,848
total attempts, avg 1.7-day intervals). It brute-forces retention through aggressive
short-interval scheduling.

SSP-MMC is the most efficient: 88.4% success rate with only 42,743 attempts and 6.25-day
average intervals. Best efficiency-to-retention ratio.


## 6. Discussion

### 6.1 Key Innovations

1. ICL-Based Semantic Analysis: LLM capabilities applied to educational technology.
   Assesses semantic relationships without task-specific fine-tuning.

2. Semantic-Aware Scheduling: Explicitly models semantic relationships, addressing
   the limitation of existing algorithms that treat learning items in isolation.

3. Multi-Dimensional Optimization: Semantic, temporal, personal, difficulty-based
   factors create a more nuanced scheduling approach.

4. Adaptive Personalization: Dynamic learning profiles enable continuous adaptation,
   moving beyond static parameter adjustment.

### 6.2 Limitations

- Computational Overhead: LLM integration requires additional resources despite caching.
- LLM Dependency: Semantic analysis depends on external LLM services.
- Evaluation Scope: Only vocabulary learning evaluated; broader applicability unproven.
- Simulated Learners: No real human validation.

### 6.3 Future Work

- Extension to other learning domains beyond vocabulary
- Alternative semantic analysis approaches (local models, embeddings-only)
- Offline semantic models to reduce dependency
- Long-term real-world user studies


## 7. Conclusion

LECTOR successfully integrates LLM-powered semantic analysis with personalized learning
profiles and established spaced repetition principles. The algorithm demonstrates
significant improvements in learning success rates, particularly in scenarios involving
semantic interference.

The key innovations -- semantic-aware scheduling, multi-dimensional optimization, and
adaptive personalization -- establish new directions for intelligent tutoring systems.
While computational considerations require careful management, demonstrated improvements
in learning effectiveness justify the additional complexity.


## Reproducibility

The authors commit to releasing complete source code and datasets on GitHub upon paper
acceptance.


## AI Involvement Disclosure

The paper discloses that "IntelliKernelAI" AI agent system contributed significantly to
hypothesis development, experimental design, implementation, analysis, and writing, with
human researchers providing direction and review oversight.


## References

[1] Ebbinghaus, H. (1885). Memory: A Contribution to Experimental Psychology
[2] Wozniak, P.A. (1998). SuperMemo 2 Algorithm
[3] Settles, B. and Meeder, B. (2016). A Trainable Spaced Repetition Model for Language Learning (HLR)
[4] Ye, J. (2024). Free Spaced Repetition Scheduler (FSRS)
[5] Brown, T.B. et al. (2020). Language Models are Few-Shot Learners (GPT-3/ICL)
[6-18] Additional references on knowledge tracing, deep learning, cognitive science
