import * as React from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from "@mui/material";
import type { Item } from "../types";

type Props = {
  open: boolean;
  item: Item | null;
  onClose: () => void;
  onSave: (id: number, body: { title: string; description: string }) => void;
};

export default function EditItemDialog({ open, item, onClose, onSave }: Props) {
  const [title, setTitle] = React.useState("");
  const [desc, setDesc] = React.useState("");

  React.useEffect(() => {
    setTitle(item?.title ?? "");
    setDesc(item?.description ?? "");
  }, [item, open]);

  const submit = () => {
    if (!item) return;
    onSave(item.id, { title, description: desc });
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Edit Item</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          fullWidth
          label="Title"
          margin="dense"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <TextField
          fullWidth
          label="Description"
          margin="dense"
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={submit} disabled={!title.trim()}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

