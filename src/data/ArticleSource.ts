// Where the game gets article text from. The demo looks in the pre-generated
// cache (milestone 3) and falls back to templates built from the facts. The full
// game will put a shared server behind this same interface.
import type { Story } from './schemas.ts';
import { templateArticle } from '../summarizer/templates.ts';
import type { Article, ArticleRequest } from '../summarizer/types.ts';

export interface ArticleSource {
  get(req: ArticleRequest, story: Story): Article;
}

export class TemplateArticleSource implements ArticleSource {
  get(req: ArticleRequest, story: Story): Article {
    return { ...templateArticle(story, req.tier), origin: 'template' };
  }
}

let source: ArticleSource = new TemplateArticleSource();

export function articleSource(): ArticleSource {
  return source;
}

export function setArticleSource(next: ArticleSource): void {
  source = next;
}
