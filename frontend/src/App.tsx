import * as React from "react";
import { api } from "./api"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Container, Box, Button, TextField, List, ListItem, ListItemText,
  IconButton, Dialog, DialogTitle, DialogContent, DialogActions
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";

type Item = { id: number; title: string; description: string; };

export default function App() {
  const qc = useQueryClient();
  const [q, setQ] = React.useState("");
  const { data = [] } = useQuery<Item[]>({
    queryKey: ["items", q],
    queryFn: async () => (await api.get("/items", { params: { q } })).data,
  });

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

  return (
    <Container maxWidth="md">
      <Box my={3} display="flex" gap={2} alignItems="center">
        <TextField size="small" label="Search" value={q} onChange={e => setQ(e.target.value)} />
        <Button variant="contained" onClick={() => setOpen(true)}>New</Button>
      </Box>

      <List>
        {data.map(i => (
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
