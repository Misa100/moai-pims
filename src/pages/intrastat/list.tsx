import { DataGrid, GridToolbar, type GridColDef } from "@mui/x-data-grid";
import { useInvalidate, useUpdate } from "@refinedev/core";
import { List, RefreshButton, useDataGrid } from "@refinedev/mui";
import React from "react";

export const IntrastatList = () => {
    const { dataGridProps } = useDataGrid({
        resource: "intrastat_duty_tax",
        initialPageSize: 25,
        syncWithLocation: true,
        sorters: {
            initial: [{ field: "intrastat", order: "asc" }],
        },
    });

    const invalidate = useInvalidate();

    const { mutateAsync: update } = useUpdate();

    const processRowUpdate = async (newRow: any, oldRow: any) => {
        const nextDutyTax = Number(newRow.duty_tax);
        const prevDutyTax = Number(oldRow.duty_tax);

        if (Number.isNaN(nextDutyTax)) {
            throw new Error("Duty Tax must be a number");
        }
        if (nextDutyTax === prevDutyTax) return newRow;

        const result = await update({
            resource: "intrastat_duty_tax",
            id: newRow.intrastat,
            values: {
                duty_tax: nextDutyTax
            },
            meta: {
                idColumnName: "intrastat"
            }
        });

        return result?.data ?? { ...newRow, duty_tax: nextDutyTax };
    };

    const columns = React.useMemo<GridColDef[]>(
        () => [
            {
                field: "intrastat",
                headerName: "Intrastat",
                minWidth: 200,
                display: "flex",
                flex: 1,
            },
            {
                field: "duty_tax",
                flex: 1,
                headerName: "Duty Tax",
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
                                resource: "intrastat_duty_tax",
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
                getRowId={(row) => row.intrastat}
                editMode="row"
                processRowUpdate={processRowUpdate}
                onProcessRowUpdateError={(err) => {
                    console.error(err);
                    alert((err as Error)?.message ?? "Failed to update rate");
                }}
                disableRowSelectionOnClick
                slots={{ toolbar: GridToolbar }}
                slotProps={{
                    toolbar: {
                        showQuickFilter: true,
                        quickFilterProps: { debounceMs: 400 },
                    },
                }}
            />
        </List>
    );
};
