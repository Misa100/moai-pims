create or replace function public.upsert_product_from_supplier(p jsonb)
returns table(product_id uuid, was_insert boolean, was_update boolean)
language plpgsql
as $$
declare
  v_product_uuid uuid := (p->>'product_id')::uuid;
  v_exists boolean;
begin
  if v_product_uuid is null then
    raise exception 'Supplier payload missing product_id';
  end if;

  select exists(select 1 from public.products where id=v_product_uuid) into v_exists;

  -- 0) BRAND
  with brand_upsert as (
    insert into public.brands(name)
    values (p->>'articleBrand')
    on conflict(name) do update set name=excluded.name
    returning id
  ), brand as (
    select id from brand_upsert
    union all
    select id from public.brands where name=p->>'articleBrand'
      and not exists (select 1 from brand_upsert)
  ),

  -- 1) PRODUCT (core)
  product_upsert as (
    insert into public.products(
      id, search_name, ean_code, status,
      no_dropshipping, base_article, leaves_assortment,
      modified_on, created_on, low_stock, stock_available, available_from,
      assortment, export_price, weight, volume,
      intrastat, taric, ecomobilier_rate, heritage,
      order_unit_code, order_unit_description, brand_id, extra
    )
    select
      v_product_uuid,
      p->>'searchName',
      p->>'eaNcode',
      p->>'status',
      (p->>'noDropshipping')::boolean,
      (p->>'baseArticle')::boolean,
      (p->>'leavesAssortment')::boolean,
      (p->>'modifiedOn')::timestamptz,
      (p->>'createdOn')::timestamptz,
      nullif(p->>'lowStock','')::numeric,
      nullif(p->>'stockAvailable','')::numeric,
      p->>'availableFrom',
      nullif(p->>'assortment','')::numeric,
      nullif(p->>'exportPrice','')::numeric,
      nullif(p->>'weight','')::numeric,
      nullif(p->>'volume','')::numeric,
      p->>'intrastat',
      p->>'taric',
      nullif(p->>'ecomobilierRate','')::numeric,
      p->>'heritage',
      p->'orderUnit'->>'code',
      p->'orderUnit'->>'description',
      (select id from brand),
      jsonb_strip_nulls(jsonb_build_object(
        'stockInfo',            p->'stockInfo',
        'odor',                 p->'odor',
        'burningTime',          p->'burningTime',
        'dishwasherResistant',  p->'dishwasherResistant',
        'fireRetardant',        p->'fireRetardant',
        'removableCover',       p->'removableCover',
        'washingInstructions',  p->'washingInstructions',
        'pillowDensity',        p->'pillowDensity',
        'safeForOutdoors',      p->'safeForOutdoors',
        'assembly',             p->'assembly',
        'ovenResistant',        p->'ovenResistant',
        'microwaveResistant',   p->'microwaveResistant',
        'carryingWeight',       p->'carryingWeight',
        'sittingDepth',         p->'sittingDepth',
        'sittingHeight',        p->'sittingHeight',
        'lampSocket',           p->'lampSocket',
        'maxWatt',              p->'maxWatt',
        'cableLength',          p->'cableLength',
        'varia',                p->'varia',
        'type',                 p->'type',
        'collection',           p->'collection'
      ))
    on conflict(id) do update set
      search_name = excluded.search_name,
      ean_code = excluded.ean_code,
      status = excluded.status,
      no_dropshipping = excluded.no_dropshipping,
      base_article = excluded.base_article,
      leaves_assortment = excluded.leaves_assortment,
      modified_on = excluded.modified_on,
      low_stock = excluded.low_stock,
      stock_available = excluded.stock_available,
      available_from = excluded.available_from,
      assortment = excluded.assortment,
      export_price = excluded.export_price,
      weight = excluded.weight,
      volume = excluded.volume,
      intrastat = excluded.intrastat,
      taric = excluded.taric,
      ecomobilier_rate = excluded.ecomobilier_rate,
      heritage = excluded.heritage,
      order_unit_code = excluded.order_unit_code,
      order_unit_description = excluded.order_unit_description,
      brand_id = excluded.brand_id,
      extra = excluded.extra
    returning id
  ),

  -- 2) TRANSLATIONS
  t_en as (
    insert into public.product_translations(product_id, locale_code, short_desc, long_desc)
    values (v_product_uuid, 'EN', p->'description'->'EN'->>'short', p->'description'->'EN'->>'extended')
    on conflict(product_id, locale_code) do update
      set short_desc=excluded.short_desc, long_desc=excluded.long_desc
  ),
  t_fr as (
    insert into public.product_translations(product_id, locale_code, short_desc, long_desc)
    values (v_product_uuid, 'FR', p->'description'->'FR'->>'short', p->'description'->'FR'->>'extended')
    on conflict(product_id, locale_code) do update
      set short_desc=excluded.short_desc, long_desc=excluded.long_desc
  ),

  -- 3) PACKAGING (item/inner/master)
  pkg_item as (
    insert into public.product_packaging(product_id, kind, width, height, length, weight_net)
    values (v_product_uuid,'item',
      nullif(p->'packagingItem'->>'width','')::numeric,
      nullif(p->'packagingItem'->>'height','')::numeric,
      nullif(p->'packagingItem'->>'length','')::numeric,
      nullif(p->'packagingItem'->>'weightNet','')::numeric
    )
    on conflict(product_id,kind) do update set
      width=excluded.width, height=excluded.height, length=excluded.length, weight_net=excluded.weight_net
  ),
  pkg_inner as (
    insert into public.product_packaging(product_id, kind, width, height, length, volume, weight_gross, weight_net, quantity, info)
    values (v_product_uuid,'inner',
      nullif(p->'packagingInner'->>'width','')::numeric,
      nullif(p->'packagingInner'->>'height','')::numeric,
      nullif(p->'packagingInner'->>'length','')::numeric,
      nullif(p->'packagingInner'->>'volume','')::numeric,
      nullif(p->'packagingInner'->>'weightGross','')::numeric,
      nullif(p->'packagingInner'->>'weightNet','')::numeric,
      nullif(p->'packagingInner'->>'quantity','')::numeric,
      p->'packagingInner'->>'info'
    )
    on conflict(product_id,kind) do update set
      width=excluded.width, height=excluded.height, length=excluded.length,
      volume=excluded.volume, weight_gross=excluded.weight_gross,
      weight_net=excluded.weight_net, quantity=excluded.quantity, info=excluded.info
  ),
  pkg_master as (
    insert into public.product_packaging(product_id, kind, width, height, length, volume, weight_gross, weight_net, quantity)
    values (v_product_uuid,'master',
      nullif(p->'packagingMaster'->>'width','')::numeric,
      nullif(p->'packagingMaster'->>'height','')::numeric,
      nullif(p->'packagingMaster'->>'length','')::numeric,
      nullif(p->'packagingMaster'->>'volume','')::numeric,
      nullif(p->'packagingMaster'->>'weightGross','')::numeric,
      nullif(p->'packagingMaster'->>'weightNet','')::numeric,
      nullif(p->'packagingMaster'->>'quantity','')::numeric
    )
    on conflict(product_id,kind) do update set
      width=excluded.width, height=excluded.height, length=excluded.length,
      volume=excluded.volume, weight_gross=excluded.weight_gross,
      weight_net=excluded.weight_net, quantity=excluded.quantity
  ),

  -- 4) E-COM BLOCK
  ecom as (
    insert into public.product_ecom(
      product_id, min_quantity, dim_width, dim_height, dim_length, weight_net,
      box_minimum_id, box_code, box_width, box_height, box_length, box_type
    )
    values (
      v_product_uuid,
      nullif(p->'ecom'->>'minQuantity','')::numeric,
      nullif(p->'ecom'->'dimensions'->>'width','')::numeric,
      nullif(p->'ecom'->'dimensions'->>'height','')::numeric,
      nullif(p->'ecom'->'dimensions'->>'length','')::numeric,
      nullif(p->'ecom'->'dimensions'->>'weightNet','')::numeric,
      nullif(p->'ecom'->'boxMinimum'->>'id','')::uuid,
      p->'ecom'->'boxMinimum'->>'box',
      nullif(p->'ecom'->'boxMinimum'->>'width','')::numeric,
      nullif(p->'ecom'->'boxMinimum'->>'height','')::numeric,
      nullif(p->'ecom'->'boxMinimum'->>'length','')::numeric,
      p->'ecom'->'boxMinimum'->>'type'
    )
    on conflict(product_id) do update set
      min_quantity=excluded.min_quantity,
      dim_width=excluded.dim_width, dim_height=excluded.dim_height, dim_length=excluded.dim_length,
      weight_net=excluded.weight_net,
      box_minimum_id=excluded.box_minimum_id, box_code=excluded.box_code,
      box_width=excluded.box_width, box_height=excluded.box_height,
      box_length=excluded.box_length, box_type=excluded.box_type
  ),

  -- 5) TAXONOMIES & CATEGORIES
  cat_leaf as (
    -- Site category from groupInfo hierarchy
    select public.upsert_category_path(
      'category',
      array[
        nullif(p->'groupInfo'->>'group',''),
        nullif(p->'groupInfo'->>'subGroup',''),
        nullif(p->'groupInfo'->>'detailGroup',''),
        nullif(p->'groupInfo'->>'level4Group','')
      ]::text[],
      null
    ) as category_id
  ),
  link_cat as (
    insert into public.product_categories(product_id, category_id)
    select v_product_uuid, category_id from cat_leaf where category_id is not null
    on conflict do nothing
  ),
  catalog_names as (
    select
      max((cg->>'description')) filter (where cg->>'isoCode'='EN')  as cg_en,
      max((csg->>'description')) filter (where csg->>'isoCode'='EN') as csg_en,
      max((cg->>'description')) filter (where cg->>'isoCode'='FR')  as cg_fr,
      max((csg->>'description')) filter (where csg->>'isoCode'='FR') as csg_fr
    from lateral jsonb_array_elements(coalesce(p->'catalogGroup','[]'::jsonb)) cg,
         lateral jsonb_array_elements(coalesce(p->'catalogSubgroup','[]'::jsonb)) csg
  ),
  catalog_leaf as (
    select public.upsert_category_path(
      'catalog',
      array[ nullif((select cg_en  from catalog_names),''),
             nullif((select csg_en from catalog_names),'') ]::text[],
      array[ nullif((select cg_fr  from catalog_names),''),
             nullif((select csg_fr from catalog_names),'') ]::text[]
    ) as category_id
  ),
  link_catalog as (
    insert into public.product_categories(product_id, category_id)
    select v_product_uuid, category_id from catalog_leaf where category_id is not null
    on conflict do nothing
  ),

  -- 6) ATTRIBUTES: color/material → options + translations → link
  ensure_attr_color as (
    insert into public.attributes(code, datatype, is_variant, description)
    values ('color','option',true,'Color')
    on conflict(code) do nothing
    returning id
  ),
  color_attr_id as (
    select id from ensure_attr_color
    union all
    select id from public.attributes where code='color'
      and not exists (select 1 from ensure_attr_color)
  ),
  ensure_attr_material as (
    insert into public.attributes(code, datatype, is_variant, description)
    values ('material','option',true,'Material')
    on conflict(code) do nothing
    returning id
  ),
  material_attr_id as (
    select id from ensure_attr_material
    union all
    select id from public.attributes where code='material'
      and not exists (select 1 from ensure_attr_material)
  ),
  color_src as (
    select
      trim(nullif((ac->'translations'->>'EN'),'')) as en_label,
      trim(nullif((ac->'translations'->>'FR'),'')) as fr_label
    from lateral jsonb_array_elements(coalesce(p->'articleColors','[]'::jsonb)) ac
    limit 1
  ),
  color_opt as (
    insert into public.attribute_options(attribute_id, code)
    select (select id from color_attr_id),
           lower(regexp_replace((select en_label from color_src), '[^A-Za-z0-9]+','-','g'))
    where (select en_label from color_src) is not null
    on conflict(attribute_id, code) do update set code=excluded.code
    returning id
  ),
  color_opt_id as (
    select id from color_opt
    union all
    select ao.id
    from public.attribute_options ao
    where ao.attribute_id=(select id from color_attr_id)
      and ao.code=lower(regexp_replace(coalesce((select en_label from color_src),'unknown'), '[^A-Za-z0-9]+','-','g'))
      and not exists (select 1 from color_opt)
  ),
  color_tr_en as (
    insert into public.attribute_option_translations(option_id, locale_code, label)
    select (select id from color_opt_id), 'EN', (select en_label from color_src)
    where (select en_label from color_src) is not null
    on conflict(option_id, locale_code) do update set label=excluded.label
  ),
  color_tr_fr as (
    insert into public.attribute_option_translations(option_id, locale_code, label)
    select (select id from color_opt_id), 'FR', (select fr_label from color_src)
    where (select fr_label from color_src) is not null
    on conflict(option_id, locale_code) do update set label=excluded.label
  ),
  p_color as (
    insert into public.product_attribute_values(product_id, attribute_id, option_id)
    select v_product_uuid, (select id from color_attr_id), (select id from color_opt_id)
    where (select id from color_opt_id) is not null
    on conflict(product_id, attribute_id, option_id) do nothing
  ),
  material_src as (
    select
      trim(nullif((am->'translations'->'EN'->>'description'),'')) as en_label,
      trim(nullif((am->'translations'->'FR'->>'description'),'')) as fr_label
    from lateral jsonb_array_elements(coalesce(p->'articleMaterials','[]'::jsonb)) am
    limit 1
  ),
  material_opt as (
    insert into public.attribute_options(attribute_id, code)
    select (select id from material_attr_id),
           lower(regexp_replace((select en_label from material_src), '[^A-Za-z0-9]+','-','g'))
    where (select en_label from material_src) is not null
    on conflict(attribute_id, code) do update set code=excluded.code
    returning id
  ),
  material_opt_id as (
    select id from material_opt
    union all
    select ao.id
    from public.attribute_options ao
    where ao.attribute_id=(select id from material_attr_id)
      and ao.code=lower(regexp_replace(coalesce((select en_label from material_src),'unknown'), '[^A-Za-z0-9]+','-','g'))
      and not exists (select 1 from material_opt)
  ),
  material_tr_en as (
    insert into public.attribute_option_translations(option_id, locale_code, label)
    select (select id from material_opt_id), 'EN', (select en_label from material_src)
    where (select en_label from material_src) is not null
    on conflict(option_id, locale_code) do update set label=excluded.label
  ),
  material_tr_fr as (
    insert into public.attribute_option_translations(option_id, locale_code, label)
    select (select id from material_opt_id), 'FR', (select fr_label from material_src)
    where (select fr_label from material_src) is not null
    on conflict(option_id, locale_code) do update set label=excluded.label
  ),
  p_material as (
    insert into public.product_attribute_values(product_id, attribute_id, option_id)
    select v_product_uuid, (select id from material_attr_id), (select id from material_opt_id)
    where (select id from material_opt_id) is not null
    on conflict(product_id, attribute_id, option_id) do nothing
  ),
  comp as (
    insert into public.product_material_compositions(product_id, material_option_id, percentage)
    select v_product_uuid,
           (select id from material_opt_id),
           (select (mc->>'percentage')::numeric
              from lateral jsonb_array_elements(coalesce(p->'articleMaterialComposition','[]'::jsonb)) mc
              limit 1)
    where (select id from material_opt_id) is not null
      and (select (mc->>'percentage')::numeric
             from lateral jsonb_array_elements(coalesce(p->'articleMaterialComposition','[]'::jsonb)) mc
             limit 1) is not null
    on conflict(product_id, material_option_id) do update set percentage=excluded.percentage
  ),

  -- 7) PRICES (mirror export_price, set duty_tax if mapping exists else 1)
  price_upsert as (
    insert into public.product_prices(product_id, price_supplier, duty_tax, updated_at)
    values (
      v_product_uuid,
      coalesce(nullif(p->>'exportPrice','')::numeric,0),
      coalesce((select duty_tax from public.intrastat_duty_tax where intrastat = p->>'intrastat'), 1),
      now()
    )
    on conflict(product_id) do update
      set price_supplier = excluded.price_supplier,
          duty_tax       = excluded.duty_tax,
          updated_at     = now()
    returning product_id
  )
  select 1;

  return query
    select v_product_uuid as product_id, (not v_exists) as was_insert, v_exists as was_update;
end $$;
