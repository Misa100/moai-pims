import { DataGrid, type GridColDef } from "@mui/x-data-grid";
import { useInvalidate, useUpdate } from "@refinedev/core";
import { List, RefreshButton, useDataGrid } from "@refinedev/mui";
import React from "react";

export const GeneralConfigsList = () => {
    const { dataGridProps } = useDataGrid({
        resource: "config_rates",
        initialPageSize: 25,
        syncWithLocation: true,
    });

    const invalidate = useInvalidate();

    const { mutateAsync: update } = useUpdate();

    const processRowUpdate = async (newRow: any, oldRow: any) => {
        const nextRate = Number(newRow.rate);
        const prevRate = Number(oldRow.rate);

        if (Number.isNaN(nextRate)) {
            throw new Error("Rate must be a number");
        }
        if (nextRate === prevRate) return newRow;

        const result = await update({
            resource: "config_rates",
            id: newRow.id,
            values: {
                rate: nextRate
            }
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
                                invalidates: ["list"], // revalidate the list query
                            })
                        }
                    />
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
