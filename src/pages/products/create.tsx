import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  useNotification,
  useList,
} from "@refinedev/core";
import { Create } from "@refinedev/mui";
import {
  Box,
  Stack,
  TextField,
  IconButton,
  Button,
  Typography,
  Paper,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import Grid from "@mui/material/Grid2";
import { supabaseClient } from "../../utility";

type Row = { sku: string; quantity: number | string };

export const ImportCreate: React.FC = () => {
  const navigate = useNavigate();
  const { open: notify } = useNotification();

  const [rows, setRows] = React.useState<Row[]>([{ sku: "", quantity: 1 }]);

  const addRow = () => setRows((r) => [...r, { sku: "", quantity: 1 }]);
  const removeRow = (idx: number) =>
    setRows((r) => r.filter((_, i) => i !== idx));

  const updateRow = (idx: number, key: keyof Row, value: string) =>
    setRows((r) =>
      r.map((row, i) =>
        i === idx ? { ...row, [key]: key === "quantity" ? value : value.trim() } : row
      )
    );

  const handleSubmit = async () => {
    const skus = rows.map((r) => r.sku).filter(Boolean);
    const quantities = rows.map((r) => Number(r.quantity) || 0);

    if (!skus.length) {
      notify?.({ type: "error", message: "Please enter at least one SKU" });
      return;
    }

    const { data, error } = await supabaseClient.rpc("enqueue_product_import_manual", {
      skus,
      quantities,
    });

    if (error) {
      notify?.({ type: "error", message: "Enqueue failed", description: error.message });
      return;
    }

    notify?.({ type: "success", message: "Batch created", description: "Queued for processing" });
    navigate(`/imports/show/${data}`);
  };

  return (
    <Create title="Import Products (Manual)">
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">
          Enter SKU and Quantity. Existing SKUs will be updated.
        </Typography>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={1.5}>
            {rows.map((row, idx) => (
              <Grid container spacing={1} key={idx} alignItems="center">
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField
                    label="SKU"
                    value={row.sku}
                    fullWidth
                    onChange={(e) => updateRow(idx, "sku", e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 10, sm: 4 }}>
                  <TextField
                    label="Quantity"
                    type="number"
                    value={row.quantity}
                    fullWidth
                    onChange={(e) => updateRow(idx, "quantity", e.target.value)}
                    inputProps={{ step: "1", min: "0" }}
                  />
                </Grid>
                <Grid size={{ xs: 2, sm: 2 }}>
                  <IconButton
                    aria-label="delete"
                    onClick={() => removeRow(idx)}
                    disabled={rows.length === 1}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Grid>
              </Grid>
            ))}
            <Box>
              <Button startIcon={<AddIcon />} onClick={addRow}>
                Add Row
              </Button>
            </Box>
          </Stack>
        </Paper>
        <Box>
          <Button variant="contained" onClick={handleSubmit}>
            Save & Queue
          </Button>
        </Box>
      </Stack>
    </Create>
  );
};
