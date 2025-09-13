export type Item = { id: number; title: string; description: string };
export const PAGE_SIZE = 20;
export type ItemsPage = { items: Item[]; total: number; page: number };
