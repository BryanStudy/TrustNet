"use client";

import React from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useArticles } from "@/hooks/useArticles";
import { constructFileUrl } from "@/utils/fileUtils";
import { useRouter } from "next/navigation";
import { Eye, TrendingUp } from "lucide-react";
import { CATEGORY_COLORS } from "@/config/articles";



export default function LiteracyHubPage() {
  const { articles, loading, isError, error } = useArticles();
  const router = useRouter();

  // Sort all articles by view count
  const sortedArticles = [...(articles || [])].sort((a: any, b: any) => (b.viewCount || 0) - (a.viewCount || 0));

  // Get top 3 trending articles
  const trendingArticles = sortedArticles.slice(0, 3);
  // Get remaining articles
  const remainingArticles = sortedArticles.slice(3);

  return (
    <div className="flex flex-col max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-sans-bold text-[var(--c-coal)] mb-2">
          Articles Directory
        </h1>
        <h2 className="text-xl font-mono text-gray-600">
          Discover Digital Literacy Articles
        </h2>
      </div>

      {/* Trending Articles */}
      <div className="mb-12">
        <h3 className="text-2xl font-sans-bold text-[var(--c-coal)] mb-6 flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-[var(--c-violet)]" />
          Trending Articles
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {trendingArticles.map((article: any) => {
            const initials = article.authorName
              ? article.authorName.split(" ").map((n: string) => n[0]).join("").toUpperCase()
              : "AU";
            return (
              <Card
                key={article.articleId}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:border-[var(--c-violet)] hover:shadow-lg transition-all duration-300 cursor-pointer group p-0"
                onClick={() => router.push(`/literacy-hub/${article.articleId}`)}
                tabIndex={0}
                role="button"
                aria-label={`View article: ${article.title}`}
              >
                {/* Article Cover Image */}
                {article.coverImage ? (
                  <div className="relative w-full aspect-[16/9] bg-gray-100 rounded-t-2xl overflow-hidden flex items-center justify-center p-0 m-0">
                    <img
                      src={constructFileUrl(article.coverImage, "article-images")}
                      alt="Cover"
                      className="object-cover w-full h-full"
                      style={{ minHeight: 0, minWidth: 0, display: 'block' }}
                    />
                  </div>
                ) : (
                  <div className="relative w-full aspect-[16/9] bg-gray-200 rounded-t-2xl overflow-hidden flex items-center justify-center p-0 m-0">
                    <span className="text-gray-500 font-mono text-sm">Article Image</span>
                  </div>
                )}

                {/* Article Content */}
                <div className="p-6">
                  {/* Author Info */}
                  <div className="flex items-center gap-3 mb-4">
                    <Avatar className="w-8 h-8 rounded-lg">
                      {article.authorPicture ? (
                        <AvatarImage
                          src={constructFileUrl(article.authorPicture, "profile-pictures")}
                          alt={article.authorName}
                        />
                      ) : null}
                      <AvatarFallback className="bg-[var(--c-mauve)] text-[var(--c-violet)] text-sm font-mono">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-2 text-sm">
                      <span className="font-mono-bold text-[var(--c-coal)]">
                        {article.authorName || "Author"}
                      </span>
                      <span className="text-gray-400">•</span>
                      <span className="font-mono text-gray-500">
                        {article.createdAt ? new Date(article.createdAt).toLocaleString() : ""}
                      </span>
                    </div>
                  </div>

                  {/* Article Title */}
                  <h3 className="font-sans-bold text-lg text-[var(--c-coal)] mb-2 group-hover:text-[var(--c-violet)] transition-colors line-clamp-2">
                    {article.title}
                  </h3>

                  {/* View Count */}
                  <div className="flex items-center gap-1 mb-3 text-gray-500 font-mono text-xs">
                    <Eye className="w-3 h-3" />
                    <span>{article.viewCount || 0} {(article.viewCount === 1) ? "view" : "views"}</span>
                  </div>

                  {/* Article Content Preview */}
                  <p className="font-mono text-sm text-gray-600 mb-4 line-clamp-3">
                    {article.content}
                  </p>

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <Badge className={`font-mono text-xs px-3 py-1 rounded-full ${CATEGORY_COLORS[article.category as keyof typeof CATEGORY_COLORS] || 'bg-gray-100 text-gray-800'}`}>
                      {article.category}
                    </Badge>
                    <span className="font-mono text-xs text-gray-500">
                      {article.readTime ? `${article.readTime} min read` : ""}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Other Articles */}
      <div>
        <h3 className="text-2xl font-sans-bold text-[var(--c-coal)] mb-6">
          Other Articles
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-full text-center font-mono text-lg py-20">Loading...</div>
          ) : isError ? (
            <div className="col-span-full text-center font-mono text-lg text-red-500 py-20">
              Error loading articles.
            </div>
          ) : remainingArticles.length === 0 ? (
            <div className="col-span-full text-center font-mono text-lg py-20">No Articles</div>
          ) : (
            remainingArticles.map((article: any) => {
              const initials = article.authorName
                ? article.authorName.split(" ").map((n: string) => n[0]).join("").toUpperCase()
                : "AU";
              return (
                <Card
                  key={article.articleId}
                  className="bg-white rounded-2xl border border-gray-200 overflow-hidden hover:border-[var(--c-violet)] hover:shadow-lg transition-all duration-300 cursor-pointer group p-0"
                  onClick={() => router.push(`/literacy-hub/${article.articleId}`)}
                  tabIndex={0}
                  role="button"
                  aria-label={`View article: ${article.title}`}
                >
                  {/* Article Cover Image */}
                  {article.coverImage ? (
                    <div className="relative w-full aspect-[16/9] bg-gray-100 rounded-t-2xl overflow-hidden flex items-center justify-center p-0 m-0">
                      <img
                        src={constructFileUrl(article.coverImage, "article-images")}
                        alt="Cover"
                        className="object-cover w-full h-full"
                        style={{ minHeight: 0, minWidth: 0, display: 'block' }}
                      />
                    </div>
                  ) : (
                    <div className="relative w-full aspect-[16/9] bg-gray-200 rounded-t-2xl overflow-hidden flex items-center justify-center p-0 m-0">
                      <span className="text-gray-500 font-mono text-sm">Article Image</span>
                    </div>
                  )}

                  {/* Article Content */}
                  <div className="p-6">
                    {/* Author Info */}
                    <div className="flex items-center gap-3 mb-4">
                      <Avatar className="w-8 h-8 rounded-lg">
                        {article.authorPicture ? (
                          <AvatarImage
                            src={constructFileUrl(article.authorPicture, "profile-pictures")}
                            alt={article.authorName}
                          />
                        ) : null}
                        <AvatarFallback className="bg-[var(--c-mauve)] text-[var(--c-violet)] text-sm font-mono">
                          {initials}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-mono-bold text-[var(--c-coal)]">
                          {article.authorName || "Author"}
                        </span>
                        <span className="text-gray-400">•</span>
                        <span className="font-mono text-gray-500">
                          {article.createdAt ? new Date(article.createdAt).toLocaleString() : ""}
                        </span>
                      </div>
                    </div>

                    {/* Article Title */}
                    <h3 className="font-sans-bold text-lg text-[var(--c-coal)] mb-2 group-hover:text-[var(--c-violet)] transition-colors line-clamp-2">
                      {article.title}
                    </h3>

                    {/* View Count */}
                    <div className="flex items-center gap-1 mb-3 text-gray-500 font-mono text-xs">
                      <Eye className="w-3 h-3" />
                      <span>{article.viewCount || 0} {(article.viewCount === 1) ? "view" : "views"}</span>
                    </div>

                    {/* Article Content Preview */}
                    <p className="font-mono text-sm text-gray-600 mb-4 line-clamp-3">
                      {article.content}
                    </p>

                    {/* Footer */}
                    <div className="flex items-center justify-between">
                      <Badge className={`font-mono text-xs px-3 py-1 rounded-full ${CATEGORY_COLORS[article.category as keyof typeof CATEGORY_COLORS] || 'bg-gray-100 text-gray-800'}`}>
                        {article.category}
                      </Badge>
                      <span className="font-mono text-xs text-gray-500">
                        {article.readTime ? `${article.readTime} min read` : ""}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}