import * as React from "react";
import { useParams } from "react-router-dom";
import { useOne } from "@refinedev/core";
import { Show, List, useDataGrid } from "@refinedev/mui";
import {
  Box,
  Stack,
  Typography,
  Divider,
  Chip,
  Button,
  Snackbar,
  Alert,
  CircularProgress,
} from "@mui/material";
import { DataGrid, GridColDef, GridToolbar } from "@mui/x-data-grid";
import type { LogicalFilter } from "@refinedev/core";
import { supabaseClient } from "../../utility";

const dt = new Intl.DateTimeFormat("en-MU", {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Indian/Mauritius",
});
const fmtDT = (v?: string | null) => {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? String(v) : dt.format(d);
};

const BUCKET = "imports";
const FOLDER = "generated_po";

// ── N8N webhook URL ──────────────────────────────────────────────────────────
const CREATE_PO_WEBHOOK_URL = `${import.meta.env.VITE_N8N_BASE_URL}${import.meta.env.VITE_WEBHOOK_CREATE_PO}`;

const buildStoragePath = (input?: string | null) => {
  if (!input) return undefined;
  const clean = String(input).replace(/^\/+/, "");
  if (clean.startsWith(`${FOLDER}/`)) return clean;
  const fileOnly = clean.split("/").pop() ?? clean;
  return `${FOLDER}/${fileOnly}`;
};

export const ImportBatchShow: React.FC = () => {
  const { id } = useParams();

  const [downloading, setDownloading] = React.useState(false);
  const [creatingPO, setCreatingPO] = React.useState(false);

  // Snackbar state
  const [snack, setSnack] = React.useState<{
    open: boolean;
    severity: "success" | "error";
    message: string;
  }>({ open: false, severity: "success", message: "" });

  const closeSnack = () => setSnack((s) => ({ ...s, open: false }));

  // ── Fetch batch header ─────────────────────────────────────────────────────
  const { data: batch, isLoading: isBatchLoading } = useOne({
    resource: "v_product_import_batch_stats",
    id,
    liveMode: "auto",
    queryOptions: { enabled: !!id },
  });

  // ── Permanent filter for items grid ───────────────────────────────────────
  const permanentFilters: LogicalFilter[] = React.useMemo(
    () =>
      id ? [{ field: "batch_id", operator: "eq" as const, value: id }] : [],
    [id]
  );

  const { dataGridProps } = useDataGrid({
    resource: "v_product_import_items",
    filters: { permanent: permanentFilters },
    initialPageSize: 50,
    liveMode: "auto",
    sorters: { initial: [{ field: "created_at", order: "asc" }] },
    queryOptions: { enabled: !!id, keepPreviousData: true },
  });

  const columns = React.useMemo<GridColDef[]>(
    () => [
      { field: "sku", headerName: "SKU", minWidth: 140, flex: 0.6 },
      { field: "quantity", headerName: "Qty", width: 80 },
      { field: "status", headerName: "Status", width: 120 },
      { field: "attempts", headerName: "Attempts", width: 100 },
      {
        field: "updated_at",
        headerName: "Updated",
        width: 180,
        renderCell: (params) => (
          <span>{fmtDT((params?.value as string) ?? null)}</span>
        ),
      },
      { field: "error_message", headerName: "Error", minWidth: 220, flex: 1 },
    ],
    []
  );

  // ── Download PO (unchanged logic) ─────────────────────────────────────────
  const handleDownload = async () => {
    const path = buildStoragePath(batch?.data?.po_file_path);
    if (!path) return;

    try {
      setDownloading(true);

      const { data, error } = await supabaseClient.storage
        .from(BUCKET)
        .createSignedUrl(path, 60);

      if (error || !data?.signedUrl) throw error ?? new Error("No signed URL");

      const res = await fetch(data.signedUrl);
      if (!res.ok) throw new Error("Failed to fetch file");
      const blob = await res.blob();

      const fileName = path.split("/").pop() || "download.xlsx";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      URL.revokeObjectURL(a.href);
      a.remove();
    } catch (e) {
      console.error(e);
      alert("Could not download the file.");
    } finally {
      setDownloading(false);
    }
  };

  // ── Create PO in Odoo via n8n webhook ─────────────────────────────────────
  const handleCreatePO = async () => {
    if (!id) return;
    try {
      setCreatingPO(true);

      const res = await fetch(CREATE_PO_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ batch_id: id }),
      });

      if (!res.ok) throw new Error(`Webhook error: ${res.status}`);

      const data = await res.json();

      if (data?.success && data?.po_name) {
        setSnack({
          open: true,
          severity: "success",
          message: `PO created successfully: ${data.po_name}`,
        });
      } else {
        throw new Error("Unexpected response from webhook");
      }
    } catch (e) {
      console.error(e);
      setSnack({
        open: true,
        severity: "error",
        message: "Failed to create PO in Odoo. Please try again.",
      });
    } finally {
      setCreatingPO(false);
    }
  };

  const hasPOFile = !!batch?.data?.po_file_path;

  return (
    <Show
      title="Import Batch"
      canDelete={false}
      canEdit={false}
      isLoading={isBatchLoading}
      goBack={false}
      headerButtons={
        <Stack direction="row" spacing={1}>
          {/* Download PO — same logic as before */}
          <Button
            variant="outlined"
            onClick={handleDownload}
            disabled={!hasPOFile || downloading}
          >
            {downloading ? "Downloading..." : "Download PO"}
          </Button>

          {/* Create PO in Odoo — same activation condition as Download PO */}
          <Button
            variant="contained"
            onClick={handleCreatePO}
            disabled={!hasPOFile || creatingPO}
            startIcon={
              creatingPO ? (
                <CircularProgress size={16} color="inherit" />
              ) : undefined
            }
          >
            {creatingPO ? "Creating PO..." : "Create PO in Odoo"}
          </Button>
        </Stack>
      }
    >
      <Stack spacing={2}>
        <Box>
          <Typography variant="h6">Batch</Typography>
          <Typography variant="body2" color="text.secondary">
            ID: {batch?.data?.id ?? "—"}
          </Typography>

          <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
            <Chip size="small" label={batch?.data?.source ?? "—"} />
            <Chip
              size="small"
              color="primary"
              label={batch?.data?.status ?? "—"}
            />
          </Stack>

          <Stack direction="row" spacing={4} sx={{ mt: 1 }}>
            <Typography variant="body2">
              Created: {fmtDT(batch?.data?.created_at)}
            </Typography>
            <Typography variant="body2">
              Started: {fmtDT(batch?.data?.started_at)}
            </Typography>
            <Typography variant="body2">
              Finished: {fmtDT(batch?.data?.finished_at)}
            </Typography>
          </Stack>

          {batch?.data?.file_path && (
            <Typography variant="body2" sx={{ mt: 0.5 }}>
              File: {batch.data.file_path}
            </Typography>
          )}
        </Box>

        <Divider />

        <List title="Items">
          <DataGrid
            {...dataGridProps}
            getRowId={(row) => row.id}
            columns={columns}
            disableRowSelectionOnClick
            slots={{ toolbar: GridToolbar }}
            slotProps={{
              toolbar: {
                showQuickFilter: false,
                quickFilterProps: { debounceMs: 400 },
              },
            }}
          />
        </List>
      </Stack>

      {/* Confirmation / error snackbar */}
      <Snackbar
        open={snack.open}
        autoHideDuration={6000}
        onClose={closeSnack}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={closeSnack}
          severity={snack.severity}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {snack.message}
        </Alert>
      </Snackbar>
    </Show>
  );
};