import type { BasicLawDomain, BasicLawQuestion } from "./basic-law-types";

const domainOrder: Record<BasicLawDomain,number> = { "basic-law":0, nsl:1 };

export function compareBasicLawQuestions(left:BasicLawQuestion,right:BasicLawQuestion){
  const domainDifference=domainOrder[left.domain]-domainOrder[right.domain];
  if(domainDifference)return domainDifference;
  const leftArticle=left.article??Number.POSITIVE_INFINITY;
  const rightArticle=right.article??Number.POSITIVE_INFINITY;
  return leftArticle-rightArticle||left.sourceSet-right.sourceSet||left.sourceQuestion-right.sourceQuestion;
}
