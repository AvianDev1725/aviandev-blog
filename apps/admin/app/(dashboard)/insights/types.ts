export type Metric = { values: number[]; previous: number };

export type TopPost = { postId: number; title: string; slug: string; views: number; visitors: number; readThrough: number };

export type Overview = {
  days: number;
  dates: string[];
  kpis: { visitors: Metric; views: Metric; returning: Metric; signups: Metric; comments: Metric; questions: Metric };
  topPosts: TopPost[];
  sources: { source: string; visits: number }[];
};

export type Traffic = {
  days: number;
  dates: string[];
  visitors: Metric;
  views: Metric;
  returning: Metric;
  newVisitors: Metric;
  organic: Metric;
  sources: { source: string; visits: number }[];
  engines: { name: string; visits: number }[];
  referrers: { host: string; visits: number }[];
  devices: { device: string; visits: number }[];
  signedIn: { readers: number; guests: number };
  pages: { path: string; views: number }[];
};

export type Content = {
  days: number;
  dates: string[];
  counts: { total: number; published: number; drafts: number };
  posts: (TopPost & { comments: number; topics: string[] })[];
  mostCommented: { postId: number; title: string; slug: string; comments: number }[];
  topics: { name: string; slug: string; posts: number }[];
  comments: Metric;
};

export type People = {
  days: number;
  dates: string[];
  counts: {
    readers: number;
    verified: number;
    notVerified: number;
    banned: number;
    admins: number;
    superAdmins: number;
    waiting: number;
    signedInVisitors: number;
  };
  signups: Metric;
};

export type SearchRow = { query: string; searches: number; averageResults: number; openedPercent: number; engagement: number };

export type Search = {
  days: number;
  totals: { searches: number; withResults: number; reachedResultsPage: number; opened: number; engagement: number };
  perDay: { day: string; searches: number }[];
  ideas: { query: string; searches: number; lastSearched: string }[];
  top: SearchRow[];
  unclicked: SearchRow[];
  sections: { url: string; visits: number; postTitle: string; heading: string }[];
};

export type Ask = {
  days: number;
  totals: { questions: number; answered: number; notFound: number; errors: number; helpful: number; notHelpful: number };
  perDay: { day: string; questions: number }[];
  unanswered: { question: string; times: number; lastAsked: string }[];
  sections: { url: string; times: number; postTitle: string; heading: string }[];
};

export type TabId = 'overview' | 'traffic' | 'content' | 'people' | 'search' | 'ask';

export type TabData = {
  overview: Overview;
  traffic: Traffic;
  content: Content;
  people: People;
  search: Search;
  ask: Ask;
};

export const TAB_IDS: TabId[] = ['overview', 'traffic', 'content', 'people', 'search', 'ask'];
export const RANGES = [7, 30, 90] as const;