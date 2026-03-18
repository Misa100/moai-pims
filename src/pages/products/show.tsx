import * as React from "react";
import { Show } from "@refinedev/mui";
import {
  HttpError,
  useShow,
  useUpdate,
  useCreate,
  useInvalidate,
  useNotification,
} from "@refinedev/core";
import {
  Box,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Stack,
  Typography,
  TextField,
  Button,
  Chip,
} from "@mui/material";
// ✅ MUI v6 Grid2
import Grid from "@mui/material/Grid2";

type FlatRow = {
  id: string;
  search_name?: string;
  ean_code?: string;
  status?: string;
  no_dropshipping?: boolean;
  base_article?: boolean;
  leaves_assortment?: boolean;
  modified_on?: string;
  created_on?: string;
  low_stock?: number;
  stock_available?: number;
  available_from?: string;
  export_price?: number;
  weight?: number;
  volume?: number;
  intrastat?: string;
  taric?: string;
  ecomobilier_rate?: number;
  heritage?: string;
  order_unit_code?: string;
  order_unit_description?: string;
  brand_name?: string;

  short_desc_en?: string;
  long_desc_en?: string;
  short_desc_fr?: string;
  long_desc_fr?: string;

  quantity?: number;
  duty_tax?: number;
  transport?: number;
  margin?: number;
  price_supplier?: number;
  total_price_supplier?: number;
  unit_price_mur?: number;
  sales_price?: number;
  sales_price_shop?: number;
  prices_updated_at?: string;

  ecom_min_quantity?: number;
  ecom_dim_width?: number;
  ecom_dim_height?: number;
  ecom_dim_length?: number;
  ecom_weight_net?: number;
  ecom_box_minimum_id?: string;
  ecom_box_code?: string;
  ecom_box_width?: number;
  ecom_box_height?: number;
  ecom_box_length?: number;
  ecom_box_type?: string;

  pkg_item_width?: number;
  pkg_item_height?: number;
  pkg_item_length?: number;
  pkg_item_weight_net?: number;

  pkg_inner_width?: number;
  pkg_inner_height?: number;
  pkg_inner_length?: number;
  pkg_inner_volume?: number;
  pkg_inner_weight_gross?: number;
  pkg_inner_weight_net?: number;
  pkg_inner_quantity?: number;
  pkg_inner_info?: string;

  pkg_master_width?: number;
  pkg_master_height?: number;
  pkg_master_length?: number;
  pkg_master_volume?: number;
  pkg_master_weight_gross?: number;
  pkg_master_weight_net?: number;
  pkg_master_quantity?: number;

  colors_en?: string[];
  colors_fr?: string[];
  materials_en?: string[];
  materials_fr?: string[];
  material_composition?: Array<{ material_en?: string; material_fr?: string; percentage?: number }>;

  category_path_en?: string;
  category_path_fr?: string;
  catalog_path_en?: string;
  catalog_path_fr?: string;
};

const SUPABASE_META_PK = { idColumnName: "product_id" };

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

const nf = (v: any, d = 2) =>
  v === null || v === undefined || v === "" ? "—" : Number(v).toFixed(d);

const Line = ({ label, value }: { label: string; value?: React.ReactNode }) => (
  <Stack direction="row" spacing={2} sx={{ py: 0.5 }}>
    <Typography variant="body2" sx={{ width: 200, color: "text.secondary" }}>
      {label}
    </Typography>
    <Typography variant="body2" sx={{ fontWeight: 500 }}>
      {value ?? "—"}
    </Typography>
  </Stack>
);

export const ProductShow: React.FC = () => {
  const { query } = useShow<FlatRow, HttpError>({ resource: "product_flat_table" });
  const { data, isLoading } = query;
  const record = data?.data;

  const { mutateAsync: updatePrice } = useUpdate();
  const { mutateAsync: createPrice } = useCreate();
  const invalidate = useInvalidate();
  const { open: notify } = useNotification();

  const [priceState, setPriceState] = React.useState({
    quantity: 0,
    duty_tax: 0,
    transport: 0,
    margin: 0,
    sales_price_shop: 0,
  });

  React.useEffect(() => {
    if (record) {
      setPriceState({
        quantity: Number(record.quantity ?? 0),
        duty_tax: Number(record.duty_tax ?? 0),
        transport: Number(record.transport ?? 0),
        margin: Number(record.margin ?? 0),
        sales_price_shop: Number(record.sales_price_shop ?? 0),
      });
    }
  }, [record?.id]);

  const handlePriceChange =
    (key: keyof typeof priceState) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value;
      const n = v === "" ? 0 : Number(v);
      setPriceState((s) => ({ ...s, [key]: Number.isFinite(n) ? n : 0 }));
    };

  const handleSavePrices = async () => {
    if (!record?.id) {
      notify?.({ type: "error", message: "Missing product id" });
      return;
    }
    const productId = String(record.id);

    try {
      await updatePrice({
        resource: "product_prices",
        id: productId,
        values: priceState,
        meta: SUPABASE_META_PK,
      });
    } catch (e: any) {
      const msg = String(e?.message ?? "");
      const needsCreate =
        e?.statusCode === 404 ||
        msg.includes("No rows") ||
        msg.includes("Results contain 0 rows");

      if (!needsCreate) {
        notify?.({ type: "error", message: "Update failed", description: msg });
        return;
      }

      await createPrice({
        resource: "product_prices",
        values: { product_id: productId, ...priceState },
      });
    }

    invalidate({ resource: "product_flat_table", invalidates: ["detail", "list", "many"] });

    notify?.({
      type: "success",
      message: "Prices saved",
      description: "Pricing fields were updated.",
    });
  };

  return (
    <Show isLoading={isLoading} title="Product">
      {record ? (
        <Stack spacing={2}>
          {/* Header / Summary */}
          <Card>
            <CardHeader
              title={
                <Stack direction="row" spacing={1} alignItems="center">
                  <Typography variant="h6">
                    {record.long_desc_en || record.short_desc_en || record.search_name || "Product"}
                  </Typography>
                  {record.status && (
                    <Chip size="small" label={record.status} color="primary" variant="outlined" />
                  )}
                </Stack>
              }
              subheader={record.long_desc_fr}
            />
            <CardContent>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Line label="SKU" value={record.search_name} />
                  <Line label="EAN" value={record.ean_code} />
                  <Line label="Brand" value={record.brand_name} />
                  <Line label="Intrastat" value={record.intrastat} />
                  <Line label="TARIC" value={record.taric} />
                  <Line label="Available From" value={record.available_from} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Line label="Stock (On Order)" value={record.stock_available} />
                  <Line label="Low Stock" value={record.low_stock} />
                  <Line label="Modified" value={fmtDT(record.modified_on)} />
                  <Line label="Created" value={fmtDT(record.created_on)} />
                  <Line
                    label="Order Unit"
                    value={`${record.order_unit_code ?? ""} ${record.order_unit_description ?? ""}`}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Descriptions */}
          <Card>
            <CardHeader title="Descriptions" />
            <CardContent>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    English
                  </Typography>
                  <Line label="Short" value={record.short_desc_en} />
                  <Line label="Long" value={record.long_desc_en} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Français
                  </Typography>
                  <Line label="Court" value={record.short_desc_fr} />
                  <Line label="Long" value={record.long_desc_fr} />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Prices (editable) */}
          <Card>
            <CardHeader title="Prices" />
            <CardContent>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 6, lg: 4 }}>
                  <Line label="Supplier Cost (EUR)" value={nf(record.price_supplier)} />
                  <Line label="Total Cost (EUR)" value={nf(record.total_price_supplier)} />
                  <Line label="Unit Cost (Rs)" value={nf(record.unit_price_mur)} />
                  <Line label="Sale Price (Rs)" value={nf(record.sales_price)} />
                  <Line label="Last Price Update" value={fmtDT(record.prices_updated_at)} />
                </Grid>

                <Grid size={{ xs: 12, md: 6, lg: 8 }}>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 6, md: 4 }}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Quantity"
                        value={priceState.quantity}
                        onChange={handlePriceChange("quantity")}
                        inputProps={{ step: "1" }}
                      />
                    </Grid>
                    <Grid size={{ xs: 6, md: 4 }}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Duty Tax"
                        value={priceState.duty_tax}
                        onChange={handlePriceChange("duty_tax")}
                        inputProps={{ step: "0.01" }}
                      />
                    </Grid>
                    <Grid size={{ xs: 6, md: 4 }}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Transport"
                        value={priceState.transport}
                        onChange={handlePriceChange("transport")}
                        inputProps={{ step: "0.01" }}
                      />
                    </Grid>
                    <Grid size={{ xs: 6, md: 4 }}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Margin"
                        value={priceState.margin}
                        onChange={handlePriceChange("margin")}
                        inputProps={{ step: "0.01" }}
                      />
                    </Grid>
                    <Grid size={{ xs: 6, md: 4 }}>
                      <TextField
                        fullWidth
                        type="number"
                        label="Web Sale Price (Rs)"
                        value={priceState.sales_price_shop}
                        onChange={handlePriceChange("sales_price_shop")}
                        inputProps={{ step: "1" }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <Stack direction="row" spacing={2}>
                        <Button variant="contained" onClick={handleSavePrices}>
                          Save Prices
                        </Button>
                      </Stack>
                    </Grid>
                  </Grid>
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Dimensions & Weight */}
          <Card>
            <CardHeader title="Dimensions & Weight" />
            <CardContent>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Item
                  </Typography>
                  <Line label="Width" value={nf(record.pkg_item_width)} />
                  <Line label="Height" value={nf(record.pkg_item_height)} />
                  <Line label="Length" value={nf(record.pkg_item_length)} />
                  <Line label="Weight Net" value={nf(record.pkg_item_weight_net)} />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Inner
                  </Typography>
                  <Line label="Width" value={nf(record.pkg_inner_width)} />
                  <Line label="Height" value={nf(record.pkg_inner_height)} />
                  <Line label="Length" value={nf(record.pkg_inner_length)} />
                  <Line label="Volume" value={nf(record.pkg_inner_volume)} />
                  <Line label="Weight Gross" value={nf(record.pkg_inner_weight_gross)} />
                  <Line label="Weight Net" value={nf(record.pkg_inner_weight_net)} />
                  <Line label="Quantity" value={nf(record.pkg_inner_quantity)} />
                  <Line label="Info" value={record.pkg_inner_info} />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Master
                  </Typography>
                  <Line label="Width" value={nf(record.pkg_master_width)} />
                  <Line label="Height" value={nf(record.pkg_master_height)} />
                  <Line label="Length" value={nf(record.pkg_master_length)} />
                  <Line label="Volume" value={nf(record.pkg_master_volume)} />
                  <Line label="Weight Gross" value={nf(record.pkg_master_weight_gross)} />
                  <Line label="Weight Net" value={nf(record.pkg_master_weight_net)} />
                  <Line label="Quantity" value={nf(record.pkg_master_quantity)} />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* E-commerce */}
          <Card>
            <CardHeader title="E-commerce" />
            <CardContent>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Line label="Min Quantity" value={record.ecom_min_quantity} />
                  <Line label="Box Type" value={record.ecom_box_type} />
                  <Line label="Box Code" value={record.ecom_box_code} />
                  <Line label="Box ID" value={record.ecom_box_minimum_id} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Line
                    label="Dim (W × H × L)"
                    value={`${nf(record.ecom_dim_width)} × ${nf(record.ecom_dim_height)} × ${nf(
                      record.ecom_dim_length
                    )}`}
                  />
                  <Line label="Weight Net" value={nf(record.ecom_weight_net)} />
                  <Line
                    label="Box (W × H × L)"
                    value={`${nf(record.ecom_box_width)} × ${nf(record.ecom_box_height)} × ${nf(
                      record.ecom_box_length
                    )}`}
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          {/* Categories */}
          <Card>
            <CardHeader title="Categories" />
            <CardContent>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                Site Category (EN)
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {record.category_path_en || "—"}
              </Typography>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                Site Category (FR)
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {record.category_path_fr || "—"}
              </Typography>
              <Divider sx={{ my: 1.5 }} />
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                Catalog (EN)
              </Typography>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {record.catalog_path_en || "—"}
              </Typography>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
                Catalog (FR)
              </Typography>
              <Typography variant="body2">{record.catalog_path_fr || "—"}</Typography>
            </CardContent>
          </Card>

          {/* Attributes */}
          <Card>
            <CardHeader title="Attributes" />
            <CardContent>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Colors
                  </Typography>
                  <Line label="EN" value={record.colors_en?.join(", ") || "—"} />
                  <Line label="FR" value={record.colors_fr?.join(", ") || "—"} />
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Materials
                  </Typography>
                  <Line label="EN" value={record.materials_en?.join(", ") || "—"} />
                  <Line label="FR" value={record.materials_fr?.join(", ") || "—"} />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Composition
                  </Typography>
                  {record.material_composition?.length ? (
                    <Stack spacing={0.5}>
                      {record.material_composition.map((m, i) => (
                        <Typography key={i} variant="body2">
                          {m.material_en ?? m.material_fr ?? "Material"} — {nf(m.percentage, 0)}%
                        </Typography>
                      ))}
                    </Stack>
                  ) : (
                    <Typography variant="body2">—</Typography>
                  )}
                </Grid>
              </Grid>
            </CardContent>
          </Card>
        </Stack>
      ) : (
        <Box />
      )}
    </Show>
  );
};
