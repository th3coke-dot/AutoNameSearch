export type ScreenStatus = "clear" | "conflict" | "unchecked" | "error";

export interface DomainResult {
  tld: string;
  available: boolean | null;
  status: ScreenStatus;
  detail?: string;
}

export interface TrademarkHit {
  office: "USPTO" | "EUIPO" | "WIPO";
  mark: string;
  status?: string;
  url?: string;
}

export interface TrademarkResult {
  status: ScreenStatus;
  hits: TrademarkHit[];
  detail?: string;
}

export interface CompanyScreenResult {
  source: "crunchbase" | "github" | "linkedin";
  status: ScreenStatus;
  matches: string[];
  detail?: string;
}

export interface BrandScores {
  enterpriseFeel: number;
  scandinavianDna: number;
  typography: number;
  pronunciation: number;
  memorability: number;
  investorAppeal: number;
  logoPotential: number;
  verbPotential: number;
  ecosystemFit: number;
}

export interface ScoredName {
  name: string;
  domains: DomainResult[];
  trademarks: TrademarkResult;
  companies: CompanyScreenResult[];
  scores: BrandScores;
  total: number;
  domainOk: boolean;
  trademarkOk: boolean;
  companyOk: boolean;
}

export interface PipelineStageStats {
  name: string;
  input: number;
  output: number;
  rejected: number;
  durationMs: number;
  notes?: string;
}

export interface PipelineConfig {
  /** Target generated candidates before filtering */
  candidateCount: number;
  seed?: number;
  maxLength: number;
  /** Domain TLDs to check */
  tlds: string[];
  /** Skip live HTTP screens (domain DNS still optional) */
  skipExternal: boolean;
  /** Cap how many names hit external APIs */
  externalLimit: number;
  /** Final ranked shortlist size */
  topN: number;
  /** Prefer Scandinavian / engineering phonetic DNA */
  scandinavianBias: number;
}

export interface PipelineResult {
  runId: string;
  createdAt: string;
  config: PipelineConfig;
  stages: PipelineStageStats[];
  shortlist: ScoredName[];
  totals: {
    generated: number;
    afterLinguistic: number;
    afterDomain: number;
    afterTrademark: number;
    afterCompany: number;
    scored: number;
  };
}

export const DEFAULT_CONFIG: PipelineConfig = {
  candidateCount: 50_000,
  maxLength: 8,
  tlds: ["com", "ai", "io"],
  skipExternal: false,
  externalLimit: 2_000,
  topN: 50,
  scandinavianBias: 0.85,
};
