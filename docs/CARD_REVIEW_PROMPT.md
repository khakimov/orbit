# Card Review Prompt Design

ref: https://andymatuschak.org/prompts/

This document captures the principles, examples, and anti-patterns from Andy Matuschak's
prompt-writing guide. It serves as the reference for the AI card review system prompt
(`supabase/functions/review-card/index.ts`).

---

## Core properties

Every retrieval practice prompt must satisfy all five:

| Property   | Meaning                                              | Test                                      |
|------------|------------------------------------------------------|-------------------------------------------|
| Focused    | One idea/detail per card                             | Can you state the target in one phrase?    |
| Precise    | Unambiguous what to recall                           | Is there exactly one correct answer?       |
| Consistent | Same answer every review                             | Would you recall different subsets?         |
| Tractable  | ~90% accuracy target; light cues OK                  | Do you sigh when this card appears?        |
| Effortful  | Genuine recall, not trivial inference                | Could you answer without knowing the topic?|

---

## Prompt types

### 1. Factual
*Knowing what.* Simple fact retrieval. Best for discrete details: names, quantities, definitions.
Pair with explanation prompts to add meaning -- facts alone are brittle.

- Q: `What type of chicken parts are used in stock?`
- A: `Bones.`
- Q: `2 lbs chicken bones yields roughly ??? qt stock`
- A: `1.5 qt`
- Q: `How long will chicken stock keep in the fridge?`
- A: `A week.`

### 2. Explanation
*Knowing why.* Connect facts to reasoning. These deepen understanding beyond rote recall and
make factual prompts more durable by hooking them into causal chains.

- Q: `How do bones produce a chicken stock's rich texture?`
- A: `They're full of gelatin.`
- Q: `Why does the recipe claim we should prepare chicken stock over low heat?`
- A: `Brighter, cleaner flavour.`
- Q: `Chicken stock doesn't make vegetables taste like chicken; it makes them taste more ???`
- A: `Complete.`

Key: explanation prompts ask "why" or "how", not "what". The answer should reveal
a mechanism, reason, or connection -- not just restate a fact.

### 3. Cloze / fill-in-the-blank
Decompose lists into individual deletions. Use `???` as the blank.
Each card tests recall of one missing element from a known set.

- Q: `Typical chicken stock aromatics: onion, ???, celery, garlic, parsley`
- A: `Carrots`

With a cue (acceptable -- don't penalise cues that hint without solving):

- Q: `Typical aromatics: onion, carrots, celery, garlic, ??? (herb)`
- A: `Parsley`

Bad cue (gives it away): `??? (rhymes with parrots)` -- solves the puzzle without recall.

### 4. Procedural
*Knowing how.* Knowledge needed to perform specific tasks. Focus on keywords:
important verbs, conditions, timing, sequencing. Don't try to encode an entire
procedure in one card -- extract the non-obvious steps and decision points.

- Q: `At what speed should you heat a pot of ingredients for chicken stock?`
- A: `Slowly.`
- Q: `How long should it take to heat a batch of chicken stock (2 lbs bones)?`
- A: `About an hour.`
- Q: `What should I do before using a fresh batch of stock?`
- A: `Remove the fat cap.`
- Q: `What should I do with skimmed stock fat?`
- A: `Use as savoury cooking fat.`

Strategy for procedures:
1. Identify the keywords (verbs, adverbs, conditions) that carry the meaning.
2. Write one card per keyword or decision point.
3. Add explanation cards for the non-obvious steps ("why slowly?").
4. Skip trivially inferable steps ("put ingredients in pot").

### 5. Conceptual (multiple lenses)
Understanding a concept means seeing it from several angles. Write prompts that
approach the same idea through different lenses:

Attributes/tendencies:
- Q: `How are stocks usually made?` / A: `Simmering flavourful ingredients in water.`

Similarities/differences:
- Q: `How is stock different from soup broth?` / A: `Broth has complete flavour; stock is a versatile foundation.`

Parts and wholes:
- Q: `Name at least three examples of stock:` / A: `Chicken, vegetable, mushroom, pork`

Causes and effects:
- Q: `Why do restaurants use stock instead of water? (name two reasons)` / A: `Adds flavour, improves texture.`

Significance:
- Q: `What liquid building block explains tastier restaurant dishes?` / A: `Stock.`

### 6. Salience / behavioral
Aim to change real-world behaviour, not just test memory. These keep ideas top-of-mind
until they naturally integrate into habits.

- Q: `What should I ask myself when using water in savoury cooking?`
- A: `Should I use stock instead?`
- Q: `What should I do with the carcass of a roast chicken?`
- A: `Freeze it and make chicken stock.`
- Q: `To keep my freezer full of chicken stock, I'll ??? instead of ??? when buying chicken.`
- A: `Buy whole birds; buying parts`

### 7. Creative
Request a novel answer each time. Not standard retrieval practice -- leverages the
generation effect and elaborative encoding. Judge by usefulness + clarity.

- Q: `Name a vegetable puree soup you'd try with chicken stock (answer you haven't given before)`
- A: `e.g. potato, parsnip, celeriac, squash, carrot, lentil`

### 8. Mnemonic-device
Goal is the association itself, not domain accuracy. Don't penalise for being
"incomplete" in the domain -- the card exists to anchor a memory hook.

### 9. Open-list
Link instances to categories. Don't require exhaustive enumeration -- the set is
inherently indefinite.

- Q: `Name two ways you might use chicken stock.`
- A: `e.g. cooking grains, steaming greens, making puree soups, deglazing pans`

---

## Do / Don't examples

Side-by-side comparisons. Left column is the problem card, right column is the fix.

### Scope: one idea per card

Don't:
- Q: `What do you need to make chicken stock?`
- A: `Chicken bones, water, onion, carrots, celery, garlic, parsley, simmer for 1.5 hours...`
- Problem: too broad, inconsistent recall, answer is a wall of text.

Do:
- Q: `What type of chicken parts are used in stock?` / A: `Bones.`
- Q: `2 lbs chicken bones yields roughly ??? qt stock` / A: `1.5 qt`
- Q: `Typical stock aromatics: onion, ???, celery, garlic, parsley` / A: `Carrots`
- Each card tests one fact. The full picture emerges from the set.

### Binary -> open-ended

Don't:
- Q: `Does chicken stock make vegetables taste like chicken?` / A: `No.`
- Problem: yes/no requires no understanding.

Do:
- Q: `How does chicken stock affect vegetable flavour?`
- A: `Makes them taste more complete -- adds body and depth without tasting like chicken.`

### Vague -> precise

Don't:
- Q: `What's the first step to cook an omelette?`
- A: `Heat the pan? Whisk the eggs? Chop the filling?`
- Problem: multiple valid answers; you'll recall a different one each time.

Do:
- Q: `When making an omelette, how must the pan be prepared before adding eggs?`
- A: `Heat butter over medium until foaming subsides.`

### Fact alone -> fact + explanation

Don't (incomplete set):
- Q: `What type of chicken parts are used in stock?` / A: `Bones.`
- This is fine *on its own*, but brittle without understanding.

Do (pair them):
- Q: `What type of chicken parts are used in stock?` / A: `Bones.`
- Q: `How do bones produce a chicken stock's rich texture?` / A: `They're full of gelatin.`
- The explanation card hooks the fact into a causal chain, making both more durable.

### Kitchen-sink answer -> split

Don't:
- Q: `How do you make chicken stock?`
- A: `Combine 2 lbs bones with 2 qt water, add onion, carrots, celery, garlic, parsley. Heat slowly (~1 hr). Simmer 1.5 hrs. Strain, cool, skim fat, refrigerate up to 1 week or freeze.`
- Problem: you'll remember some parts and forget others. Review becomes a chore.

Do: split into procedural keyword cards:
- Q: `At what speed should you heat chicken stock?` / A: `Slowly.`
- Q: `How long to simmer chicken stock?` / A: `About 1.5 hours.`
- Q: `How long will chicken stock keep in the fridge?` / A: `A week.`

### Cue that helps vs cue that solves

Don't:
- Q: `Typical aromatics: onion, ??? (rhymes with parrots), celery, garlic, parsley`
- Problem: the cue solves the puzzle. No recall needed.

Do:
- Q: `Typical aromatics: onion, ??? (root vegetable), celery, garlic, parsley`
- The cue narrows the search space without handing you the answer.

### Trivial inference -> skip or deepen

Don't:
- Q: `After adding ingredients to a pot, what do you do?` / A: `Cook them.`
- Problem: trivially inferable. No value in memorising this.

Do: skip it entirely, or write a card about the non-obvious part:
- Q: `Why bring stock to a simmer slowly instead of cranking the heat?` / A: `Brighter, cleaner flavour.`

### Rote recall -> salience prompt

Don't (only):
- Q: `What can you use instead of water in savoury cooking?` / A: `Stock.`
- Fine as a factual card, but won't change behaviour on its own.

Do (add a salience card):
- Q: `What should I ask myself when reaching for water in savoury cooking?`
- A: `Should I use stock instead?`
- This fires at the decision point where the knowledge actually matters.

---

## Anti-patterns

### Too broad
- Bad: `What do you need to make chicken stock?`
- Why: not precise, inconsistent answers, intractable
- Fix: break into specific ingredient/quantity prompts

### Binary / yes-no
- Bad: `Does chicken stock typically make vegetable dishes taste like chicken?` / `No.`
- Why: minimal effort, shallow understanding
- Fix: `How does chicken stock affect vegetable flavour?`

### Ambiguous
- Bad: `What's the first step to cook an omelette?`
- Why: multiple reasonable answers (whisk eggs, heat butter, mince filling)
- Fix: `When making an omelette, how must the pan be prepared before adding eggs?`

### Cue gives the answer away
- Bad: `Typical aromatics: onion, ??? (rhymes with parrots), celery...`
- Why: cue solves the puzzle without knowledge retrieval
- Fix: use `(root vegetable)` or move mnemonic to answer field

### Pattern-matching risk
Long distinctive question memorised by shape, not meaning. Keep questions short and simple.

### Kitchen-sink answer
Answer tries to cover everything. Should be 1-3 sentences max.
If the card needs a paragraph answer, it should be split.

### Obvious inference
Don't make prompts for things trivially derivable. Focus on non-obvious knowledge.

---

## Revision signals

Prompts to revise or delete during review:

- You sigh when the card appears ("I can never remember this") -- too hard, split or add cues.
- You know the answer but don't understand the meaning -- add explanation prompts.
- Multiple valid answers come to mind -- narrow the question.
- You've lost interest in the topic -- delete liberally.
- You consistently forget part of the answer -- split the card.

---

## Authoring workflow

1. First pass: 5-10 prompts on the most important/meaningful elements.
2. Highlight details for later batch prompt-writing.
3. Multiple passes: return as understanding deepens.
4. Revise during review: edit prompts that feel confusing or tedious.
5. Delete freely: prompts about material you no longer care about.

---

## When NOT to write prompts

- Material already deeply familiar.
- Trivial inferences for your expertise level.
- Details lacking meaningful connection to your life or work.
- Motivated by completionism rather than genuine interest.

---

## How this maps to the AI reviewer

The system prompt in `supabase/functions/review-card/index.ts` encodes these principles as:

- Core properties -> checked for every card
- Anti-patterns -> mapped to issue categories (`clarity`, `ambiguity`, `completeness`, `accuracy`, `formatting`)
- Prompt styles -> recognised and not penalised
- Splitting -> suggested when a card is too broad (with 2-3 example titles)
- Rewrites -> must be shorter/tighter than the original, never broader
