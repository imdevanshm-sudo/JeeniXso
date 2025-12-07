export enum AppView {
  LOADING = 'LOADING',
  PORTAL = 'PORTAL',
  VAULT = 'VAULT'
}

export interface MemoryLog {
  id: string;
  title: string;
  date: string;
  image: string;
  description: string;
}
