import { DataGrid, GridToolbar, type GridColDef } from "@mui/x-data-grid";
import { useInvalidate, useUpdate } from "@refinedev/core";
import {
  List,
  RefreshButton,
  useDataGrid,
} from "@refinedev/mui";
import React from "react";

export const MarginCategoryList = () => {
  const { dataGridProps } = useDataGrid({
    resource: "category_margins",
    initialPageSize: 25,
    syncWithLocation: true,
    sorters: {
      initial: [{ field: "first_level", order: "asc" }],
    },
  });

  const invalidate = useInvalidate();

  const { mutateAsync: update } = useUpdate();

  const processRowUpdate = async (newRow: any, oldRow: any) => {
    const nextMargin = Number(newRow.margin);
    const prevMargin = Number(oldRow.margin);

    if (Number.isNaN(nextMargin)) {
      throw new Error("Margin must be a number");
    }
    if (nextMargin === prevMargin) return newRow;

    const result = await update({
      resource: "category_margins",
      id: newRow.id,
      values: {
        margin: nextMargin
      }
    })

    return result?.data ?? { ...newRow, margin: nextMargin };
  }

  const columns = React.useMemo<GridColDef[]>(
    () => [
      {
        field: "first_level",
        headerName: "First Level",
        minWidth: 200,
        display: "flex",
        flex: 1,
      },
      {
        field: "second_level",
        flex: 1,
        headerName: "Second Level",
        minWidth: 200,
        display: "flex",
      },
      {
        field: "margin",
        flex: 1,
        type: "number",
        headerName: "Margin",
        minWidth: 50,
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
                resource: "category_margins",
                invalidates: ["list"],
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
