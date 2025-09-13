import * as React from "react";
import { useInfiniteQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { api, API } from "../api";
import { PAGE_SIZE } from "../types";
import type { Item, ItemsPage } from "../types";
import {
  List, ListItem, ListItemText, IconButton, Box, CircularProgress, Typography
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";

type Props = {
  q: string;
  onEdit: (item: Item) => void;
  onDelete: (id: number) => void;
};

export default function ItemsList({ q, onEdit, onDelete }: Props) {
  const qc = useQueryClient();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending } = useInfiniteQuery<ItemsPage>({
    queryKey: ["items", q],
    initialPageParam: 1,
    queryFn: async ({ pageParam }) => {
      const resp = await api.get<Item[]>("/items", {
        params: { q, page: pageParam, page_size: PAGE_SIZE },
      });
      const total = Number(resp.headers["x-total-count"] ?? 0);
      return { items: resp.data, total, page: Number(pageParam) };
    },
    getNextPageParam: (lastPage, allPages) => {
      const loaded = allPages.reduce((sum, p) => sum + p.items.length, 0);
      if (lastPage.items.length < PAGE_SIZE) return undefined;
      if (lastPage.total && loaded >= lastPage.total) return undefined;
      return lastPage.page + 1;
    },
  });

  const flatItems: Item[] = React.useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data]
  );

  const loadMoreRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { root: null, rootMargin: "200px", threshold: 0 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, q]);

  // Live updates via SSE
  React.useEffect(() => {
    const url = `${API.replace(/\/$/, "")}/items/events`;
    const es = new EventSource(url);
    es.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (!msg || !msg.type) return;

        const key = ["items", q] as const;
        if (msg.type === "created" && msg.item) {
          qc.setQueryData<InfiniteData<ItemsPage>>(key, (old) => {
            if (!old) return old;
            const pages = old.pages.map(p => ({ ...p, items: [...p.items] }));
            const first = pages[0];
            if (!first) return old;
            // If a temporary item (negative id) matches by content, replace it in place
            let replacedTemp = false;
            for (const p of pages) {
              const idx = p.items.findIndex(
                it => it.id < 0 && it.title === msg.item.title && it.description === msg.item.description
              );
              if (idx >= 0) {
                p.items[idx] = msg.item as Item;
                replacedTemp = true;
                break;
              }
            }
            if (replacedTemp) {
              return { ...old, pages };
            }
            const exists = pages.some(p => p.items.some(it => it.id === msg.item.id));
            if (exists) {
              // Replace existing
              for (const p of pages) {
                const idx = p.items.findIndex(it => it.id === msg.item.id);
                if (idx >= 0) p.items[idx] = msg.item as Item;
              }
            } else {
              // Prepend and bump totals
              first.items.unshift(msg.item as Item);
              if (first.items.length > PAGE_SIZE) first.items.pop();
              for (const p of pages) p.total = (p.total || 0) + 1;
            }
            return { ...old, pages };
          });
        } else if (msg.type === "updated" && msg.item) {
          qc.setQueryData<InfiniteData<ItemsPage>>(key, (old) => {
            if (!old) return old;
            const pages = old.pages.map(p => ({ ...p, items: p.items.map(it => it.id === msg.item.id ? (msg.item as Item) : it) }));
            return { ...old, pages };
          });
        } else if (msg.type === "deleted" && typeof msg.id === "number") {
          qc.setQueryData<InfiniteData<ItemsPage>>(key, (old) => {
            if (!old) return old;
            const pages = old.pages.map(p => ({ ...p, items: [...p.items] }));
            // Find and remove
            let removedAt = -1;
            for (let i = 0; i < pages.length; i++) {
              const idx = pages[i].items.findIndex((it) => it.id === msg.id);
              if (idx >= 0) {
                pages[i].items.splice(idx, 1);
                removedAt = i;
                break;
              }
            }
            if (removedAt >= 0) {
              // Shift items from subsequent pages to fill the gap
              for (let i = removedAt; i < pages.length - 1; i++) {
                if (pages[i + 1].items.length > 0) {
                  const shifted = pages[i + 1].items.shift();
                  if (shifted) pages[i].items.push(shifted);
                } else {
                  break;
                }
              }
              for (const p of pages) p.total = Math.max(0, (p.total || 0) - 1);
            }
            return { ...old, pages };
          });
        }
      } catch { }
    };
    es.onerror = () => {
      // The browser will attempt to reconnect automatically
    };
    return () => es.close();
  }, [qc, q]);

  return (
    <>
      <List>
        {flatItems.map((i) => (
          <ListItem
            key={i.id}
            secondaryAction={
              <Box>
                <IconButton
                  edge="end"
                  aria-label="edit"
                  onClick={() => onEdit(i)}
                >
                  <EditIcon />
                </IconButton>
                <IconButton
                  edge="end"
                  aria-label="delete"
                  onClick={() => onDelete(i.id)}
                >
                  <DeleteIcon />
                </IconButton>
              </Box>
            }
          >
            <ListItemText primary={i.title} secondary={i.description} />
          </ListItem>
        ))}
      </List>

      <Box display="flex" justifyContent="center" my={2}>
        {isPending && <CircularProgress size={24} />}
      </Box>
      <Box ref={loadMoreRef} height={1} />
      <Box display="flex" justifyContent="center" my={2}>
        {isFetchingNextPage && <CircularProgress size={24} />}
        {!hasNextPage && !isPending && flatItems.length > 0 && (
          <Typography variant="body2" color="text.secondary">
            No more results
          </Typography>
        )}
      </Box>
    </>
  );
}
