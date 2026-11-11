import type { MetadataRoute } from "next";

import { articles, comparisons, glossaryTerms } from "@/content/articles";
import { cities, industries, languages } from "@/content/landings";
import { productPages } from "@/content/products";
import { questions } from "@/content/questions";
import { site } from "@/lib/site";

/**
 * Every public route is derived from the content collections, so adding an
 * article, term, industry, language or city automatically adds its URL here.
 * Legal pages are intentionally excluded — they are drafts marked noindex.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = site.url.replace(/\/$/, "");

  const staticPaths = [
    "/",
    "/product/inbound",
    "/product/campaigns",
    "/product/instant-leads",
    "/pricing",
    "/voices",
    "/solutions",
    "/revenue-systems",
    "/about",
    "/contact",
    "/free-trial",
    "/blog",
    "/glossary",
    "/compare",
    "/questions",
  ];

  const paths = [
    ...new Set([
      ...staticPaths,
      ...productPages.map((page) => `/product/${page.slug}`),
      ...articles.map((article) => `/blog/${article.slug}`),
      ...glossaryTerms.map((term) => `/glossary/${term.slug}`),
      ...comparisons.map((comparison) => `/compare/${comparison.slug}`),
      ...industries.map((industry) => `/ai-voice-agents/for/${industry.slug}`),
      ...languages.map((language) => `/ai-voice-agents/language/${language.slug}`),
      ...cities.map((city) => `/fastest-employee/${city.slug}`),
      ...questions.map((question) => `/questions/${question.slug}`),
    ]),
  ];

  return paths.map((path) => ({
    url: `${base}${path === "/" ? "" : path}`,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : 0.7,
  }));
}
