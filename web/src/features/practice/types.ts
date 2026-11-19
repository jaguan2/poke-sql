export interface SqlAnswer {
  title: string;
  sql: string;
}

export type PracticeTopic = "basics" | "sorting" | "joins" | "aggregation" | "advanced";
export interface PracticeMetadata {
  category: PracticeTopic;
  difficulty: "Beginner" | "Intermediate" | "Advanced";
}
export interface CatalogFilters { search: string; category: "all" | PracticeTopic; status: "all" | "draft" | "completed" }
export type CatalogKind = "samples" | "challenges";
