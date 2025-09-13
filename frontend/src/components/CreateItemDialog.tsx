import * as React from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from "@mui/material";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (body: { title: string; description: string }) => void;
};

export default function CreateItemDialog({ open, onClose, onCreate }: Props) {
  const [title, setTitle] = React.useState("");
  const [desc, setDesc] = React.useState("");

  const submit = () => {
    onCreate({ title, description: desc });
    setTitle("");
    setDesc("");
    onClose();
  };

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Create Item</DialogTitle>
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
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}

