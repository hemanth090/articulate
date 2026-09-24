import type { RankedPaper } from "./types";

/**
 * Curated landmark papers for the landing page "Paper of the day" strip.
 * Rotates deterministically by day of year. Scores are null — no Jev
 * ranking has happened; the summary panel only needs the Paper fields.
 */

interface FeaturedPaper extends RankedPaper {
  /** One-line editorial pitch shown on the landing page. */
  pitch: string;
}

function paper(
  id: string,
  title: string,
  authors: string[],
  published: string,
  abstract: string,
  pitch: string,
): FeaturedPaper {
  return {
    id,
    title,
    authors,
    published,
    abstract,
    absUrl: `https://arxiv.org/abs/${id}`,
    pdfUrl: `https://arxiv.org/pdf/${id}`,
    score: null,
    confidence: null,
    pitch,
  };
}

export const FEATURED: FeaturedPaper[] = [
  paper(
    "1706.03762",
    "Attention Is All You Need",
    ["Ashish Vaswani", "Noam Shazeer", "Niki Parmar", "Jakob Uszkoreit"],
    "2017-06-12",
    "The dominant sequence transduction models are based on complex recurrent or convolutional neural networks. We propose a new simple network architecture, the Transformer, based solely on attention mechanisms.",
    "The paper that deleted recurrence, and quietly founded modern AI.",
  ),
  paper(
    "1512.03385",
    "Deep Residual Learning for Image Recognition",
    ["Kaiming He", "Xiangyu Zhang", "Shaoqing Ren", "Jian Sun"],
    "2015-12-10",
    "We present a residual learning framework to ease the training of networks that are substantially deeper than those used previously.",
    "One skip connection fixed deep learning's vanishing gradient, and won ImageNet.",
  ),
  paper(
    "2005.14165",
    "Language Models are Few-Shot Learners",
    ["Tom B. Brown", "Benjamin Mann", "Nick Ryder", "Melanie Subbiah"],
    "2020-05-28",
    "We demonstrate that scaling up language models greatly improves task-agnostic, few-shot performance, sometimes even becoming competitive with prior state-of-the-art fine-tuning approaches.",
    "GPT-3: the moment scale itself became an algorithm.",
  ),
  paper(
    "1810.04805",
    "BERT: Pre-training of Deep Bidirectional Transformers for Language Understanding",
    ["Jacob Devlin", "Ming-Wei Chang", "Kenton Lee", "Kristina Toutanova"],
    "2018-10-11",
    "We introduce a new language representation model called BERT, designed to pre-train deep bidirectional representations from unlabeled text.",
    "Masked words, bidirectional attention: the pre-train then fine-tune era begins.",
  ),
  paper(
    "2006.11239",
    "Denoising Diffusion Probabilistic Models",
    ["Jonathan Ho", "Ajay Jain", "Pieter Abbeel"],
    "2020-06-19",
    "We present high quality image synthesis results using diffusion probabilistic models, a class of latent variable models inspired by considerations from nonequilibrium thermodynamics.",
    "Noise in, images out: the seed of every modern image generator.",
  ),
  paper(
    "2001.08361",
    "Scaling Laws for Neural Language Models",
    ["Jared Kaplan", "Sam McCandlish", "Tom Henighan", "Tom B. Brown"],
    "2020-01-23",
    "We study empirical scaling laws for language model performance on the cross-entropy loss.",
    "The power laws that turned model-building into an engineering discipline.",
  ),
  paper(
    "2103.00020",
    "Learning Transferable Visual Models From Natural Language Supervision",
    ["Alec Radford", "Jong Wook Kim", "Chris Hallacy", "Aditya Ramesh"],
    "2021-02-26",
    "We demonstrate that the simple pre-training task of predicting which caption goes with which image is an efficient and scalable way to learn SOTA image representations from scratch.",
    "CLIP taught vision models to read. Zero-shot everything followed.",
  ),
];

export function featuredOfToday(): FeaturedPaper {
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start) / 86_400_000);
  return FEATURED[dayOfYear % FEATURED.length];
}
