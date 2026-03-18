import * as React from "react";
import { useNavigate } from "react-router-dom";
import { useNotification } from "@refinedev/core";
import { Create } from "@refinedev/mui";
import { Box, Stack, Button, Typography } from "@mui/material";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import { supabaseClient } from "../../utility";

export const ImportUpload: React.FC = () => {
    const { open: notify } = useNotification();
    const navigate = useNavigate();
    const [file, setFile] = React.useState<File | null>(null);

    const handleUpload = async () => {
        if (!file) {
            notify?.({ type: "error", message: "Choose a CSV file" });
            return;
        }

        // Force CSV content-type regardless of what the browser reports
        const csvFile =
            file.type === "text/csv" ? file : new File([file], file.name, { type: "text/csv" });

        const bucket = "imports"; // create this bucket in Supabase Storage
        const path = `products/${Date.now()}_${file.name.replace(/\s+/g, "_")}`;

        const { error: upErr } = await supabaseClient.storage.from(bucket).upload(path, csvFile, {
            cacheControl: "3600",
            upsert: false,
            contentType: "text/csv",
        });
        if (upErr) {
            notify?.({ type: "error", message: "Upload failed", description: upErr.message });
            return;
        }

        const file_path = `${bucket}/${path}`;
        const { data, error } = await supabaseClient.rpc("create_csv_import_batch", { file_path });
        if (error) {
            notify?.({ type: "error", message: "Batch create failed", description: error.message });
            return;
        }

        notify?.({
            type: "success",
            message: "CSV uploaded",
            description: "Batch queued. Processing will start shortly.",
        });
        navigate(`/imports/show/${data}`);
    };

    return (
        <Create title="Import Products (CSV)">
            <Stack spacing={2}>
                <Typography variant="body2" color="text.secondary">
                    CSV columns: <b>[SKU,Quantity]</b>. Existing SKUs will be updated.
                </Typography>
                <input
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <Box>
                    <Button startIcon={<UploadFileIcon />} variant="contained" onClick={handleUpload}>
                        Upload & Create Batch
                    </Button>
                </Box>
            </Stack>
        </Create>
    );
};
