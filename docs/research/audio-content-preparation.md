# Preparing technical articles for listening: evidence review

## Scope and main conclusion

This is a targeted review of accessible-audiobook production guidance, accessible-publishing standards, and relevant research. It is not a systematic literature review or a completed usability study.

The intended product is a mobile-first article-listening app. The initial use case is listening with a phone locked. Narration should preserve the author's explanations, with access to original visuals when useful, rather than replacing the source with speculative simplifications.

**The established approach is not a binary choice between an AI explanation and a link to an image. It is to preserve the original text, provide an accurate alternative for meaningful visual information, and let listeners navigate additional detail.** Keeping the original image available complements that alternative; it does not supply the information to someone who is listening without looking.

Three distinctions matter:

- **Pronunciation normalization** makes notation speakable without changing its meaning.
- **Description** conveys information actually present in a visual, interpreted in its surrounding context.
- **Additional explanation or paraphrase** changes or supplements the author's teaching. The sources below do not justify doing this automatically throughout an article.

## 1. Existing audiobook production guidance

### Library of Congress: National Library Service for the Blind and Print Disabled

The NLS **Guidelines for Image Descriptions**, released in February 2025, classify images by their narrative significance rather than applying one treatment to every image.

- A caption can be sufficient when it conveys the relevant information.
- When a meaningful image contains information the caption does not convey, add a description.
- For diagrams and other substantive visuals, describe essential context, relationships, actions, and details. Exclude irrelevant detail.
- Distinguish added descriptions from the author's words using clearly identified reader's notes.
- Review the script before recording. The guidance explicitly rejects guessing about uncertain visual elements.

The separate NLS **Narration** specification requires fidelity to the source text. It permits certain omissions and relocations under stated conditions, not arbitrary rewriting. Substantive errors require escalation rather than an unannounced correction.

**Application:** source-preserving narration with clearly labeled additions is an existing production practice. Speculative paraphrases should not be treated as faithful descriptions.

**Limit:** these are NLS production requirements, not evidence that every convention is optimal for an article-listening app. Their principles can inform the project without requiring every script or delivery convention.

Sources:

- [NLS Guidelines for Image Descriptions](https://www.loc.gov/nls/who-we-are/guidelines-and-specifications/contract-specifications/guidelines-for-image-descriptions/)
- [NLS Narration specification](https://www.loc.gov/nls/who-we-are/guidelines-and-specifications/contract-specifications/narration/)

## 2. Images, diagrams, and charts

### DAISY and W3C: brief identification plus access to detail

DAISY's Accessible Publishing Knowledge Base recommends concise alternative text and an extended description when a complex image needs one. It explicitly advises checking the surrounding prose first: do not produce a long description that contributes no additional useful information. Decorative images do not need descriptions.

W3C's complex-image guidance includes structured long descriptions containing relevant relationships, scales, values, and trends. The original image remains available. A description may include headings or a data table rather than one unbroken paragraph.

These sources distinguish **identifying an image** from **conveying its information**. An announcement that a diagram is available does the former, not the latter.

Sources:

- [DAISY: Image Descriptions](https://kb.daisy.org/publishing/docs/html/images-desc.html)
- [W3C WAI: Complex Images](https://www.w3.org/WAI/tutorials/images/complex/)

### NCAM: brief overview, then navigable detail

GBH's National Center for Accessible Media provides STEM-specific description guidance based on work with people who use accessible materials.

Its recommendations include:

- Avoid repeating information already accessible in the main text.
- Start with a brief overview, then provide detail or data.
- Let readers stop when they have the information they need.
- Preserve navigation through lists and tables instead of flattening everything into continuous narration.

The guidance often favors structured text over a fixed audio recording because assistive technology can navigate that text. This is not an argument against listening; it is an argument against trapping all information inside one linear recording.

**Application:** brief and extended descriptions should remain separate, addressable content. We should not automatically mix every description into one permanent audio file.

Source:

- [NCAM: Guidelines for Describing STEM Images](https://www.wgbh.org/ncam-resources/2026-08-25/effective-practices-for-description-of-science-content-guidelines-for-describing-stem-images)

### DAISY already distinguishes essential and optional additions

DAISY's older structured-talking-book guidance marks producer's notes as either required or optional. Optional notes can be enabled or disabled; essential information should not be classified as safely skippable.

**Application:** this gives us a useful content distinction. It does not require building the app in the legacy DAISY XML format. Nor does it establish exactly how a locked-screen phone should expose these controls.

Source:

- [DAISY: Producer's Note](https://daisy.org/guidance/info-help/guidance-training/standards/daisy-structure-guidelines-elements-block-elements-information-object-producers-note/)

## 3. Equations: existing rules and tools

There are established approaches to speaking mathematical notation, including **MathSpeak** and **ClearSpeak**. These convert expression structure into spoken wording; they are not explanations of why the mathematics is true.

ETS evaluated ClearSpeak against other speech styles for secondary-school algebra with blind and low-vision students. A later pilot examined spoken mathematics with interactive navigation. These are relevant precedents, not proof that one speech style is best for an adult with dyslexia.

There are also implementations we can reuse:

- **Speech Rule Engine (SRE)** supports MathSpeak and ClearSpeak, processes mathematical markup, and works in Node.js and browsers.
- **MathCAT** produces speech and supports navigation from MathML. Its documentation specifically points browser-based developers toward SRE.

**Application:** investigate SRE before inventing pronunciation rules or asking an LLM to freely rewrite equations. Fish would voice the prepared text; it would not decide the mathematical meaning.

**Limit:** these tools need suitable mathematical input. They do not automatically recover reliable semantics from every screenshot, informal expression, or ambiguous notation. Correct speech strings also need testing with the selected voice.

Sources:

- [ETS: Development and Initial Evaluation of ClearSpeak, 2016](https://www.ets.org/research/policy_research_reports/publications/report/2016/jwog.html)
- [ETS: Expanding Audio Access to Mathematics Expressions, 2017](https://www.ets.org/research/policy_research_reports/publications/report/2017/jxpm.html)
- [Speech Rule Engine](https://github.com/zorkow/speech-rule-engine)
- [DAISY MathCAT](https://daisy.github.io/MathCAT/)

The ETS report abstracts were reviewed; this review does not claim to have assessed their full experimental methods.

## 4. Code blocks: a less settled case

DAISY distinguishes code from surrounding prose and provides structural markup for it. Microsoft's CodeTalk research addresses the difficulty of accessing code through ordinary linear screen-reader output. Its tools expose code structure and navigation rather than relying solely on reading every line in order.

This supports retaining code as a structured object. It does **not** establish that code in a narrated blog post should always be skipped, read character by character, or replaced with an AI summary.

For example, an article about the difference between two operators needs those exact operators preserved. An overview article may already explain a code example's relevant behavior in its prose. That distinction requires context, not a universal rule about code blocks.

**Evidence gap:** this review did not identify a validated universal narration policy for source-code examples in technical articles consumed by adults with dyslexia while walking. Most relevant programming research concerns blind or low-vision developers using interactive tools.

Sources:

- [DAISY: Computer Code](https://daisy.org/guidance/info-help/guidance-training/standards/daisy-structure-guidelines-elements-block-elements-information-object-computer-code/)
- [Microsoft Research: CodeTalk](https://www.microsoft.com/en-us/research/project/codetalk/)
- [CodeTalk, CHI 2018 paper](https://www.microsoft.com/en-us/research/wp-content/uploads/2018/04/CodeTalkCHI2018CameraReady.pdf)

The CodeTalk project description supports the structural-navigation finding. This review does not make quantitative claims about its effectiveness.

## 5. What scientific research does and does not establish

### TTS can help comprehension, but benefits vary

Wood and colleagues' 2018 meta-analysis covered 22 studies of students with reading disabilities. It reported an average weighted effect size of **0.35**, with a **95% confidence interval of 0.14–0.56**, favoring TTS and related read-aloud tools. This is an effect-size measure, not a 35% comprehension improvement.

The authors reported substantial variation and methodological limitations, including diverse interventions and insufficient randomized trials. The result supports investigating TTS as an accommodation; it does not establish an optimal treatment of diagrams or support rewriting an author's prose.

- [Wood et al., full text](https://pmc.ncbi.nlm.nih.gov/articles/PMC5494021/)
- [DOI: 10.1177/0022219416688170](https://doi.org/10.1177/0022219416688170)

### Linear audio can change reading strategies without improving scores

Knoop-van Campen and colleagues, published online in 2021 and in a 2022 issue, studied written text with and without audio support in secondary-school students. The study initially included 43 students; the analyzed sample after exclusions comprised 18 students with dyslexia and 17 controls.

Audio support changed attention patterns and increased reading time in most tasks. It did not improve comprehension performance on the tested tasks. This was a specific reading-and-listening experiment, not a test of voluntary audiobook listening during a walk.

**Application:** preserve replay and navigation rather than assuming continuous narration alone is sufficient.

- [The effect of audio-support on strategy, time, and performance](https://pmc.ncbi.nlm.nih.gov/articles/PMC9187546/)

### Interactive access is promising, but evidence is limited

The AUDiaL chart-accessibility prototype was initially evaluated with nine blind or near-blind participants. Feedback indicated benefits from interactive access, but usability ratings varied. Its findings are exploratory and concern structured statistical charts, not automatically generated descriptions of arbitrary blog diagrams.

- [AUDiaL: A Natural Language Interface to Make Statistical Charts Accessible to Blind Persons](https://pmc.ncbi.nlm.nih.gov/articles/PMC7479797/)

**Overall limit:** blind-user studies, school-based dyslexia studies, and publishing guidance are useful but different evidence sources. None establishes that AI explanations outperform access to original visuals for audio-first technical articles. This review also does not establish the reliability of automated LLM image descriptions.

## 6. Implications for the proposed app

The following are preliminary design proposals derived from the sources, not finalized or experimentally proven product requirements.

1. **Preserve the original article and its structure.** Keep paragraphs, headings, figures, captions, code, and equations distinct, with source references.
2. **Use surrounding context before adding narration.** Remove duplicate extraction artifacts without deleting meaningful content. An image already explained in prose may need no extra description.
3. **Distinguish descriptions from explanations.** A faithful description conveys missing visual information. A new tutorial, inference, or paraphrase is an additional editorial intervention.
4. **Identify added material.** Keep it clearly separate from the author's words, following the reader's-note principle.
5. **Support access to both audio detail and the original visual.** Brief identification, optional extended detail, and image access are complementary options. Essential information must not be silently omitted.
6. **Reuse established math-to-speech tools.** Evaluate their output before paying to synthesize long passages.
7. **Treat code as unresolved where context is insufficient.** Preserve exact source and meaningful structure. Do not claim an AI behavioral summary is equivalent to the code.
8. **Do not flatten away future choices.** Even a small prototype should retain the boundaries between original prose and added material. The precise player controls remain a separate design question.

## 7. Recommended next step

Use these existing guidelines to create a small preparation rubric and apply it to a continuous section of the Overreacted article. For each non-prose block, record:

- What information it contributes.
- Whether the surrounding prose or caption already conveys that information.
- Whether it needs pronunciation normalization, a short description, extended structured detail, or unresolved specialist interpretation.
- Whether proposed added narration is essential or supplementary.
- Whether the description is supplied by the source, written by a human, or generated and awaiting review.

Review that preparation before generating audio. This replaces speculative isolated paraphrases with an auditable, source-preserving process. It does not require deciding a universal visual-block policy or building every accessibility feature before the first listening test.
