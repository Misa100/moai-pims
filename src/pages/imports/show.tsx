import * as React from "react";
import { useParams } from "react-router-dom";
import { useOne } from "@refinedev/core";
import { Show, List, useDataGrid } from "@refinedev/mui";
import { Box, Stack, Typography, Divider, Chip, Button } from "@mui/material";
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

const buildStoragePath = (input?: string | null) => {
  if (!input) return undefined;
  const clean = String(input).replace(/^\/+/, ""); // remove any leading '/'
  // If a full path is ever passed, keep it if it already targets the folder.
  if (clean.startsWith(`${FOLDER}/`)) return clean;

  // Otherwise assume it's just a filename and prepend the folder
  const fileOnly = clean.split("/").pop() ?? clean;
  return `${FOLDER}/${fileOnly}`;
};

export const ImportBatchShow: React.FC = () => {
  const { id } = useParams();
  const [ downloading, setDownloading ] = React.useState(false);

  // fetch the batch header
  const { data: batch, isLoading: isBatchLoading } = useOne({
    resource: "v_product_import_batch_stats",
    id,
    liveMode: "auto",
    queryOptions: { enabled: !!id },
  });

  // make the filter permanent and reactive to `id`
  const permanentFilters: LogicalFilter[] = React.useMemo(
    () =>
      id
        ? [{ field: "batch_id", operator: "eq" as const, value: id }]
        : [],
    [id]
  );

  const { dataGridProps } = useDataGrid({
    resource: "v_product_import_items",
    filters: { permanent: permanentFilters },
    initialPageSize: 50,
    liveMode: "auto",
    sorters: { initial: [{ field: "created_at", order: "asc" }] },
    // don't fetch until we have the route param
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

  const handleDownload = async () => {
    const path = buildStoragePath(batch?.data?.po_file_path);
    if (!path) return;

    try {
      setDownloading(true);

      // 1) get a short-lived signed URL
      const { data, error } = await supabaseClient
        .storage
        .from(BUCKET) 
        .createSignedUrl(path, 60); 

      if (error || !data?.signedUrl) throw error ?? new Error("No signed URL");

      // 2) download (keeps your desired filename)
      const res = await fetch(data.signedUrl);
      if (!res.ok) throw new Error("Failed to fetch file");
      const blob = await res.blob();

      const fileName =
        path.split("/").pop() || "download.xlsx";

      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = fileName; // forces "Save As"
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

  return (
    <Show
      title="Import Batch"
      canDelete={false}
      canEdit={false}
      isLoading={isBatchLoading}
      goBack={false}
      headerButtons={
        <Button
          variant="contained"
          onClick={handleDownload}
          disabled={!batch?.data?.po_file_path || downloading}
        >
          {downloading ? "Downloading..." : "Download PO"}
        </Button>
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
            <Chip size="small" color="primary" label={batch?.data?.status ?? "—"} />
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
    </Show>
  );
};
