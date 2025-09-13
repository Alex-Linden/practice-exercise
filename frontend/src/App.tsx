import * as React from "react";
import { api } from "./api";
import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { Container, Box, Button, TextField } from "@mui/material";
import ItemsList from "./components/ItemsList";
import CreateItemDialog from "./components/CreateItemDialog";
import EditItemDialog from "./components/EditItemDialog";
import type { Item, ItemsPage } from "./types";
import { PAGE_SIZE } from "./types";

export default function App() {
  const qc = useQueryClient();
  const [q, setQ] = React.useState("");
  // List is handled in ItemsList component

  const create = useMutation({
    mutationFn: (body: Omit<Item, "id">) => api.post("/items", body).then(r => r.data as Item),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: ["items", q] });
      const previous = qc.getQueryData<InfiniteData<ItemsPage>>(["items", q]);
      const tempId = -Date.now();
      const tempItem: Item = { id: tempId, title: body.title, description: body.description };
      qc.setQueryData<InfiniteData<ItemsPage>>(["items", q], (old) => {
        if (!old) return old;
        const pages = old.pages.map(p => ({ ...p, items: [...p.items] }));
        const first = pages[0];
        if (!first) return old;
        first.items.unshift(tempItem);
        if (first.items.length > PAGE_SIZE) first.items.pop();
        for (const p of pages) p.total = (p.total || 0) + 1;
        return { ...old, pages };
      });
      return { previous, tempId };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["items", q], ctx.previous);
    },
    onSuccess: (created, _vars, ctx) => {
      qc.setQueryData<InfiniteData<ItemsPage>>(["items", q], (old) => {
        if (!old) return old;
        const pages = old.pages.map(p => ({ ...p, items: [...p.items] }));
        let removedDup = 0;
        // Remove any duplicate occurrences of the created id (e.g., from SSE race)
        for (const p of pages) {
          for (let i = p.items.length - 1; i >= 0; i--) {
            if (p.items[i].id === created.id) {
              p.items.splice(i, 1);
              removedDup += 1;
            }
          }
        }
        // Replace temp with created if present; otherwise prepend
        let replacedTemp = false;
        for (const p of pages) {
          const idx = p.items.findIndex(it => it.id === ctx?.tempId);
          if (idx >= 0) {
            p.items[idx] = created;
            replacedTemp = true;
            break;
          }
        }
        if (!replacedTemp) {
          if (pages[0]) {
            pages[0].items.unshift(created);
            if (pages[0].items.length > PAGE_SIZE) pages[0].items.pop();
          }
        }
        if (removedDup > 0) {
          for (const p of pages) p.total = Math.max(0, (p.total || 0) - removedDup);
        }
        return { ...old, pages };
      });
    },
  });

  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/items/${id}`),
    onMutate: async (id: number) => {
      await qc.cancelQueries({ queryKey: ["items", q] });
      const previous = qc.getQueryData<InfiniteData<ItemsPage>>(["items", q]);
      qc.setQueryData<InfiniteData<ItemsPage>>(["items", q], (old) => {
        if (!old) return old;
        const pages = old.pages.map(p => ({ ...p, items: [...p.items] }));
        // Find and remove
        let removedAt = -1;
        for (let i = 0; i < pages.length; i++) {
          const idx = pages[i].items.findIndex((it) => it.id === id);
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
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["items", q], ctx.previous);
    },
  });

  const [open, setOpen] = React.useState(false);

  // Edit state
  const [editOpen, setEditOpen] = React.useState(false);
  const [editingId, setEditingId] = React.useState<number | null>(null);
  const [editTitle, setEditTitle] = React.useState("");
  const [editDesc, setEditDesc] = React.useState("");

  const update = useMutation({
    mutationFn: ({ id, body }: { id: number; body: Omit<Item, "id"> }) =>
      api.put(`/items/${id}`, body).then(r => r.data as Item),
    onMutate: async ({ id, body }) => {
      await qc.cancelQueries({ queryKey: ["items", q] });
      const previous = qc.getQueryData<InfiniteData<ItemsPage>>(["items", q]);
      qc.setQueryData<InfiniteData<ItemsPage>>(["items", q], (old) => {
        if (!old) return old;
        const pages = old.pages.map(p => ({ ...p, items: p.items.map(it => it.id === id ? { ...it, ...body } : it) }));
        return { ...old, pages };
      });
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["items", q], ctx.previous);
    },
    onSuccess: (updated: Item) => {
      qc.setQueryData<InfiniteData<ItemsPage>>(["items", q], (old) => {
        if (!old) return old;
        const pages = old.pages.map(p => ({ ...p, items: p.items.map((it: Item) => (it.id === updated.id ? updated : it)) }));
        return { ...old, pages };
      });
    },
  });

  // Infinite scrolling handled inside ItemsList

  return (
    <Container maxWidth="md">
      <Box my={3} display="flex" gap={2} alignItems="center">
        <TextField size="small" label="Search" value={q} onChange={e => setQ(e.target.value)} />
        <Button variant="contained" onClick={() => setOpen(true)}>New</Button>
      </Box>

      <ItemsList
        q={q}
        onDelete={(id) => del.mutate(id)}
        onEdit={(item) => {
          setEditingId(item.id);
          setEditTitle(item.title);
          setEditDesc(item.description);
          setEditOpen(true);
        }}
      />

      <CreateItemDialog
        open={open}
        onClose={() => setOpen(false)}
        onCreate={(body) => create.mutate(body)}
      />

      <EditItemDialog
        open={editOpen}
        item={editingId != null ? { id: editingId, title: editTitle, description: editDesc } : null}
        onClose={() => setEditOpen(false)}
        onSave={(id, body) => {
          update.mutate({ id, body });
          setEditingId(null);
          setEditOpen(false);
        }}
      />
    </Container>
  );
}
