drop policy "Service role can insert credits" on "public"."credits";

create table "public"."ad_generation_inputs" (
    "id" uuid not null default gen_random_uuid(),
    "user_email" text not null,
    "prompt" text not null,
    "transaction_id" text not null,
    "image_paths" text[] default '{}'::text[],
    "created_at" timestamp with time zone not null default now()
);


create table "public"."ad_generation_results" (
    "id" uuid not null default gen_random_uuid(),
    "user_email" text not null,
    "result_image_urls" text[] default '{}'::text[],
    "created_at" timestamp with time zone not null default now()
);


create table "public"."rate_limits" (
    "id" uuid not null default uuid_generate_v4(),
    "ip_address" text not null,
    "function_name" text not null,
    "request_count" integer not null default 1,
    "last_request" timestamp with time zone not null,
    "reset_at" timestamp with time zone not null,
    "created_at" timestamp with time zone default now(),
    "updated_at" timestamp with time zone default now()
);


alter table "public"."credit_configs" enable row level security;

CREATE UNIQUE INDEX ad_generation_inputs_pkey ON public.ad_generation_inputs USING btree (id);

CREATE INDEX ad_generation_inputs_user_email_idx ON public.ad_generation_inputs USING btree (user_email);

CREATE UNIQUE INDEX ad_generation_results_pkey ON public.ad_generation_results USING btree (id);

CREATE INDEX ad_generation_results_user_email_idx ON public.ad_generation_results USING btree (user_email);

CREATE INDEX idx_rate_limits_ip_function ON public.rate_limits USING btree (ip_address, function_name);

CREATE UNIQUE INDEX rate_limits_ip_address_function_name_key ON public.rate_limits USING btree (ip_address, function_name);

CREATE UNIQUE INDEX rate_limits_pkey ON public.rate_limits USING btree (id);

alter table "public"."ad_generation_inputs" add constraint "ad_generation_inputs_pkey" PRIMARY KEY using index "ad_generation_inputs_pkey";

alter table "public"."ad_generation_results" add constraint "ad_generation_results_pkey" PRIMARY KEY using index "ad_generation_results_pkey";

alter table "public"."rate_limits" add constraint "rate_limits_pkey" PRIMARY KEY using index "rate_limits_pkey";

alter table "public"."rate_limits" add constraint "rate_limits_ip_address_function_name_key" UNIQUE using index "rate_limits_ip_address_function_name_key";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

grant delete on table "public"."ad_generation_inputs" to "anon";

grant insert on table "public"."ad_generation_inputs" to "anon";

grant references on table "public"."ad_generation_inputs" to "anon";

grant select on table "public"."ad_generation_inputs" to "anon";

grant trigger on table "public"."ad_generation_inputs" to "anon";

grant truncate on table "public"."ad_generation_inputs" to "anon";

grant update on table "public"."ad_generation_inputs" to "anon";

grant delete on table "public"."ad_generation_inputs" to "authenticated";

grant insert on table "public"."ad_generation_inputs" to "authenticated";

grant references on table "public"."ad_generation_inputs" to "authenticated";

grant select on table "public"."ad_generation_inputs" to "authenticated";

grant trigger on table "public"."ad_generation_inputs" to "authenticated";

grant truncate on table "public"."ad_generation_inputs" to "authenticated";

grant update on table "public"."ad_generation_inputs" to "authenticated";

grant delete on table "public"."ad_generation_inputs" to "service_role";

grant insert on table "public"."ad_generation_inputs" to "service_role";

grant references on table "public"."ad_generation_inputs" to "service_role";

grant select on table "public"."ad_generation_inputs" to "service_role";

grant trigger on table "public"."ad_generation_inputs" to "service_role";

grant truncate on table "public"."ad_generation_inputs" to "service_role";

grant update on table "public"."ad_generation_inputs" to "service_role";

grant delete on table "public"."ad_generation_results" to "anon";

grant insert on table "public"."ad_generation_results" to "anon";

grant references on table "public"."ad_generation_results" to "anon";

grant select on table "public"."ad_generation_results" to "anon";

grant trigger on table "public"."ad_generation_results" to "anon";

grant truncate on table "public"."ad_generation_results" to "anon";

grant update on table "public"."ad_generation_results" to "anon";

grant delete on table "public"."ad_generation_results" to "authenticated";

grant insert on table "public"."ad_generation_results" to "authenticated";

grant references on table "public"."ad_generation_results" to "authenticated";

grant select on table "public"."ad_generation_results" to "authenticated";

grant trigger on table "public"."ad_generation_results" to "authenticated";

grant truncate on table "public"."ad_generation_results" to "authenticated";

grant update on table "public"."ad_generation_results" to "authenticated";

grant delete on table "public"."ad_generation_results" to "service_role";

grant insert on table "public"."ad_generation_results" to "service_role";

grant references on table "public"."ad_generation_results" to "service_role";

grant select on table "public"."ad_generation_results" to "service_role";

grant trigger on table "public"."ad_generation_results" to "service_role";

grant truncate on table "public"."ad_generation_results" to "service_role";

grant update on table "public"."ad_generation_results" to "service_role";

grant delete on table "public"."rate_limits" to "anon";

grant insert on table "public"."rate_limits" to "anon";

grant references on table "public"."rate_limits" to "anon";

grant select on table "public"."rate_limits" to "anon";

grant trigger on table "public"."rate_limits" to "anon";

grant truncate on table "public"."rate_limits" to "anon";

grant update on table "public"."rate_limits" to "anon";

grant delete on table "public"."rate_limits" to "authenticated";

grant insert on table "public"."rate_limits" to "authenticated";

grant references on table "public"."rate_limits" to "authenticated";

grant select on table "public"."rate_limits" to "authenticated";

grant trigger on table "public"."rate_limits" to "authenticated";

grant truncate on table "public"."rate_limits" to "authenticated";

grant update on table "public"."rate_limits" to "authenticated";

grant delete on table "public"."rate_limits" to "service_role";

grant insert on table "public"."rate_limits" to "service_role";

grant references on table "public"."rate_limits" to "service_role";

grant select on table "public"."rate_limits" to "service_role";

grant trigger on table "public"."rate_limits" to "service_role";

grant truncate on table "public"."rate_limits" to "service_role";

grant update on table "public"."rate_limits" to "service_role";

create policy "Anyone can view credit configs"
on "public"."credit_configs"
as permissive
for select
to public
using (true);


create policy "Only service role can update credit configs"
on "public"."credit_configs"
as permissive
for update
to public
using ((( SELECT ((current_setting('request.jwt.claims'::text, true))::json ->> 'role'::text)) = 'service_role'::text));


create policy "Users can insert their own transactions"
on "public"."credit_transactions"
as permissive
for insert
to public
with check ((auth.uid() = user_id));


CREATE TRIGGER update_rate_limits_updated_at BEFORE UPDATE ON public.rate_limits FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


