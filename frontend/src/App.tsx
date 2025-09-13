import * as React from "react";
import { api } from "./api";
import { useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Container, Box, Button, TextField, List, ListItem, ListItemText,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions, CircularProgress, Typography
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

type Item = { id: number; title: string; description: string; };

export default function App() {
  const qc = useQueryClient();
  const [q, setQ] = React.useState("");
  const PAGE_SIZE = 20;

  type Page = { items: Item[]; total: number; page: number; };

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    isPending,
  } = useInfiniteQuery<Page>({
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
      // Stop if fewer than a full page or we've reached total
      if (lastPage.items.length < PAGE_SIZE) return undefined;
      if (lastPage.total && loaded >= lastPage.total) return undefined;
      return lastPage.page + 1;
    },
  });

  const flatItems: Item[] = React.useMemo(
    () => data?.pages.flatMap(p => p.items) ?? [],
    [data]
  );
  console.log(flatItems);

  const create = useMutation({
    mutationFn: (body: Omit<Item, "id">) => api.post("/items", body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["items"] }),
  });

  const del = useMutation({
    mutationFn: (id: number) => api.delete(`/items/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["items"] }),
  });

  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [desc, setDesc] = React.useState("");

  // Infinite scroll sentinel
  const loadMoreRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver((entries) => {
      const first = entries[0];
      if (first.isIntersecting && hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    }, { root: null, rootMargin: "200px", threshold: 0 });
    observer.observe(el);
    return () => observer.disconnect();
  }, [fetchNextPage, hasNextPage, isFetchingNextPage, q]);

  return (
    <Container maxWidth="md">
      <Box my={3} display="flex" gap={2} alignItems="center">
        <TextField size="small" label="Search" value={q} onChange={e => setQ(e.target.value)} />
        <Button variant="contained" onClick={() => setOpen(true)}>New</Button>
      </Box>

      <List>
        {flatItems.map(i => (
          <ListItem
            key={i.id}
            secondaryAction={
              <IconButton edge="end" aria-label="delete" onClick={() => del.mutate(i.id)}>
                <DeleteIcon />
              </IconButton>
            }
          >
            <ListItemText primary={i.title} secondary={i.description} />
          </ListItem>
        ))}
      </List>

      {/* Status indicators and sentinel */}
      <Box display="flex" justifyContent="center" my={2}>
        {isPending && <CircularProgress size={24} />}
      </Box>
      <Box ref={loadMoreRef} height={1} />
      <Box display="flex" justifyContent="center" my={2}>
        {isFetchingNextPage && <CircularProgress size={24} />}
        {!hasNextPage && !isPending && flatItems.length > 0 && (
          <Typography variant="body2" color="text.secondary">No more results</Typography>
        )}
      </Box>

      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Create Item</DialogTitle>
        <DialogContent>
          <TextField autoFocus fullWidth label="Title" margin="dense" value={title} onChange={e => setTitle(e.target.value)} />
          <TextField fullWidth label="Description" margin="dense" value={desc} onChange={e => setDesc(e.target.value)} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => { create.mutate({ title, description: desc }); setOpen(false); setTitle(""); setDesc(""); }}
          >
            Create
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
