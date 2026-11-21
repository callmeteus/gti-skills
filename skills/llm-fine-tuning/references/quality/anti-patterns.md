# Anti-patterns

Each one cost a real run, real money, or a model that looked fine and was not. Check the plan and the result against this list before reporting.

| Anti-pattern | Why it hurts | Do instead |
|--------------|--------------|------------|
| Trusting a tokenizer that did not complain | A library rendered a model with an older vocabulary without an error; rows that "fit" overflowed by up to 16K tokens | Pin package versions, resolve the template from the model name, assert the tokenizer class |
| Reusing rows chunked for another model | Token counts differ between tokenizers | Re-chunk and re-measure for the target model |
| Choosing the adapter shape after training | An all-linear adapter could not be merged into 4-bit experts; the run was repeated | Decide where the model will run before training |
| Training on agent transcripts alone | The model learns that every session starts with a tool call | Add a self-distilled conversational slice and probe every checkpoint |
| Probing with one tool declared | Even the base called `ls` on a greeting half the time | Probe and train with the full serving tool set |
| Training without the serving system prompt | The model learns a context it will never see | Every row carries the serving system prompt |
| Assistant turns without thinking on a thinking model | The model learns to skip reasoning | Thinking on every assistant turn |
| Picking the checkpoint by lowest loss | Loss and behaviour diverge | Pick by probe and evaluation |
| Evaluating at one inference setting | Effort moved the fine-tune from 70.6% to 88.2% | Sweep the settings |
| Comparing to the base card only | The card's harness is not yours | Benchmark the base on your harness and report both |
| Launching a paid run without an estimate | Surprise bills | Offline smoke test, estimate, the user's yes |
| Publishing an unverified merge | A wrong scale or a transposed delta ships a broken model | Token-level comparison against the adapter, then the probe |
| Publishing without being asked, or public first | Weights cannot be unpublished from every mirror | Upload only on request, private first |
| Pointing an agent at a small context cap | The first request overflowed a 64K cap that counts output | Use the long-context variant and set compaction below the cap |
| Wide batches with speculative decoding | The draft model took KV memory; long sessions thrashed | Size concurrency to the remaining pool |
| Keys or personal data in rows or the repository | Rows go to a service; repositories get pushed | Scan rows; keep keys in `~/.gti/llm-fine-tuning/.env` |
| Fine-tuning to add facts | Facts change and fine-tunes blur them | Retrieval or tools |
