import React from "react";
import { Box, TextField } from "@mui/material";
import { Create } from "@refinedev/mui";
import { useForm } from "@refinedev/react-hook-form";

type ConfigRate = {
  id?: string;
  rate_name: string;
  rate: number;
};

export const GeneralConfigsCreate: React.FC = () => {
  const {
    saveButtonProps,
    register,
    formState: { errors },
  } = useForm<ConfigRate>({
    refineCoreProps: {
      resource: "config_rates",
      redirect: "list", // optionally go back to list after create
    },
    defaultValues: {
      rate_name: "",
      rate: 0,
    },
  });

  return (
    <Create title="Create Config Rate" saveButtonProps={saveButtonProps}>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          maxWidth: 520,
        }}
      >
        <TextField
          label="Rate Name"
          fullWidth
          {...register("rate_name", {
            required: "Rate Name is required",
          })}
          error={!!errors.rate_name}
        />

        <TextField
          label="Rate"
          type="number"
          fullWidth
          inputProps={{ step: "any" }} // allows decimals
          {...register("rate", {
            required: "Rate is required",
            valueAsNumber: true, // <- converts input string to number
            validate: (v) =>
              typeof v === "number" && !Number.isNaN(v)
                ? true
                : "Must be a valid number",
          })}
          error={!!errors.rate}
        />
      </Box>

    </Create>
  );
};

