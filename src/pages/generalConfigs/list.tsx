import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { useInvalidate, useUpdate, useCustomMutation } from "@refinedev/core";
import { List, RefreshButton, useDataGrid } from "@refinedev/mui";
import {
    Button,
    Menu,
    MenuItem,
    ListItemText,
    ListItemIcon,
    Divider,
    CircularProgress,
} from "@mui/material";
import CalculateIcon from "@mui/icons-material/Calculate";
import ArrowDropDownIcon from "@mui/icons-material/ArrowDropDown";
import React, { useState } from "react";
import { useNotification } from "@refinedev/core";

type RecalcFilter = "in_stock" | "out_of_stock" | "all";

const RECALC_OPTIONS: { label: string; desc: string; value: RecalcFilter }[] = [
    {
        label: "In-stock products",
        desc: "quantity > 0",
        value: "in_stock",
    },
    {
        label: "Out-of-stock products",
        desc: "quantity = 0",
        value: "out_of_stock",
    },
    {
        label: "All products",
        desc: "Entire catalog",
        value: "all",
    },
];

export const GeneralConfigsList = () => {
    const { dataGridProps } = useDataGrid({
        resource: "config_rates",
        initialPageSize: 25,
        syncWithLocation: true,
    });

    const invalidate = useInvalidate();
    const { open: notify } = useNotification();

    const { mutateAsync: update } = useUpdate();

    // Menu state
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [recalcLoading, setRecalcLoading] = useState(false);
    const menuOpen = Boolean(anchorEl);

    const handleRecalcClick = (event: React.MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
    };

    const handleRecalc = async (filter: RecalcFilter) => {
        handleMenuClose();
        setRecalcLoading(true);
        try {
            // Appel RPC Supabase — adaptez le nom selon votre fonction
            const res = await fetch(
                `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/rpc/recalculate_product_prices`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
                        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
                    },
                    body: JSON.stringify({ filter }),
                }
            );

            if (!res.ok) throw new Error(await res.text());

            notify?.({
                type: "success",
                message: "Recalcul lancé avec succès",
                description: `Filtre : ${RECALC_OPTIONS.find((o) => o.value === filter)?.label}`,
            });
        } catch (err) {
            notify?.({
                type: "error",
                message: "Erreur lors du recalcul",
                description: (err as Error).message,
            });
        } finally {
            setRecalcLoading(false);
        }
    };

    const processRowUpdate = async (newRow: any, oldRow: any) => {
        const nextRate = Number(newRow.rate);
        const prevRate = Number(oldRow.rate);

        if (Number.isNaN(nextRate)) throw new Error("Rate must be a number");
        if (nextRate === prevRate) return newRow;

        const result = await update({
            resource: "config_rates",
            id: newRow.id,
            values: { rate: nextRate },
        });

        return result?.data ?? { ...newRow, rate: nextRate };
    };

    const columns = React.useMemo<GridColDef[]>(
        () => [
            {
                field: "rate_name",
                headerName: "Rate Name",
                minWidth: 200,
                display: "flex",
                flex: 1,
            },
            {
                field: "rate",
                flex: 1,
                headerName: "Rate",
                minWidth: 50,
                type: "number",
                align: "center",
                display: "flex",
                headerAlign: "center",
                editable: true,
                valueParser: (value) => {
                    const v = Number(value);
                    return Number.isNaN(v) ? null : v;
                },
                preProcessEditCellProps: (params) => {
                    const v = Number(params.props.value);
                    return { ...params.props, error: Number.isNaN(v) };
                },
            },
        ],
        []
    );

    return (
        <List
            headerButtons={({ defaultButtons }) => (
                <>
                    {defaultButtons}
                    <RefreshButton
                        onClick={() =>
                            invalidate({
                                resource: "config_rates",
                                invalidates: ["list"],
                            })
                        }
                    />

                    {/* Bouton recalcul avec dropdown */}
                    <Button
                        variant="contained"
                        size="small"
                        startIcon={
                            recalcLoading ? (
                                <CircularProgress size={14} color="inherit" />
                            ) : (
                                <CalculateIcon fontSize="small" />
                            )
                        }
                        endIcon={<ArrowDropDownIcon />}
                        onClick={handleRecalcClick}
                        disabled={recalcLoading}
                    >
                        Recalculate prices
                    </Button>

                    <Menu
                        anchorEl={anchorEl}
                        open={menuOpen}
                        onClose={handleMenuClose}
                        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
                        transformOrigin={{ vertical: "top", horizontal: "right" }}
                    >
                        {RECALC_OPTIONS.map((option, idx) => (
                            <React.Fragment key={option.value}>
                                {idx > 0 && <Divider />}
                                <MenuItem
                                    onClick={() => handleRecalc(option.value)}
                                    sx={{ flexDirection: "column", alignItems: "flex-start", py: 1 }}
                                >
                                    <ListItemText
                                        primary={option.label}
                                        secondary={option.desc}
                                    />
                                </MenuItem>
                            </React.Fragment>
                        ))}
                    </Menu>
                </>
            )}
        >
            <DataGrid
                {...dataGridProps}
                columns={columns}
                editMode="row"
                processRowUpdate={processRowUpdate}
                onProcessRowUpdateError={(err) => {
                    console.error(err);
                    alert((err as Error)?.message ?? "Failed to update rate");
                }}
                disableRowSelectionOnClick
            />
        </List>
    );
};