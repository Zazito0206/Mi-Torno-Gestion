-- Mi Torno Gestion Beta 1P. Private tables; only the authenticated server bridge may use them.
create table public.mtg_meta (
 environment text primary key check (environment in ('test','real')),
 revision bigint not null default 0 check(revision>=0), updated_at timestamptz not null default now()
);
insert into public.mtg_meta(environment) values ('test'),('real');
create table public.mtg_products (
 environment text not null references public.mtg_meta(environment), id text not null,
 code_key text not null, doc jsonb not null check(jsonb_typeof(doc)='object'),
 photo text check(photo is null or length(photo)<=1800000), photo_version bigint not null default 0,
 primary key(environment,id), unique(environment,code_key)
);
create table public.mtg_events (
 environment text not null references public.mtg_meta(environment), id text not null,
 doc jsonb not null check(jsonb_typeof(doc)='object'), happened_at timestamptz not null,
 primary key(environment,id)
);
create index mtg_events_time on public.mtg_events(environment,happened_at desc,id);
create table public.mtg_requests(environment text not null, id text not null, revision bigint not null, created_at timestamptz not null default now(), primary key(environment,id));
create table public.mtg_imports(id uuid primary key, environment text not null references public.mtg_meta(environment), base_revision bigint not null, applied_revision bigint, expires_at timestamptz not null default now()+interval '1 hour');
create table public.mtg_import_chunks(session_id uuid not null references public.mtg_imports(id) on delete cascade, kind text not null check(kind in ('products','events')), part integer not null check(part>=0), items jsonb not null check(jsonb_typeof(items)='array'), primary key(session_id,kind,part));
create table public.mtg_login_limits(key text primary key, attempts integer not null, reset_at timestamptz not null);

alter table public.mtg_meta enable row level security;
alter table public.mtg_products enable row level security;
alter table public.mtg_events enable row level security;
alter table public.mtg_requests enable row level security;
alter table public.mtg_imports enable row level security;
alter table public.mtg_import_chunks enable row level security;
alter table public.mtg_login_limits enable row level security;
revoke all on table public.mtg_meta,public.mtg_products,public.mtg_events,public.mtg_requests,public.mtg_imports,public.mtg_import_chunks,public.mtg_login_limits from public,anon,authenticated;
grant all on table public.mtg_meta,public.mtg_products,public.mtg_events,public.mtg_requests,public.mtg_imports,public.mtg_import_chunks,public.mtg_login_limits to service_role;

create function public.mtg_allow_login(p_key text) returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
declare n integer;
begin
 insert into public.mtg_login_limits(key,attempts,reset_at) values(p_key,1,now()+interval '15 minutes')
 on conflict(key) do update set attempts=case when mtg_login_limits.reset_at<now() then 1 else mtg_login_limits.attempts+1 end,
 reset_at=case when mtg_login_limits.reset_at<now() then now()+interval '15 minutes' else mtg_login_limits.reset_at end returning attempts into n;
 return n<=12;
end $$;

create function public.mtg_commit(p_environment text,p_base_revision bigint,p_request_id text,p_upserts jsonb,p_deletes jsonb,p_events jsonb) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare current_revision bigint; next_revision bigint; previous_revision bigint; item jsonb;
begin
 select revision into current_revision from public.mtg_meta where environment=p_environment for update;
 if not found then raise exception 'INVALID_ENVIRONMENT'; end if;
 select revision into previous_revision from public.mtg_requests where environment=p_environment and id=p_request_id;
 if found then return jsonb_build_object('revision',previous_revision,'repeated',true); end if;
 if current_revision<>p_base_revision then raise exception using errcode='40001',message='REVISION_CONFLICT'; end if;
 next_revision:=current_revision+1;
 delete from public.mtg_products where environment=p_environment and id in (select jsonb_array_elements_text(p_deletes));
 for item in select value from jsonb_array_elements(p_upserts) loop
  insert into public.mtg_products(environment,id,code_key,doc,photo,photo_version)
  values(p_environment,item->'doc'->>'id',item->>'code_key',item->'doc',item->>'photo',case when coalesce((item->>'photo_changed')::boolean,false) then next_revision else 0 end)
  on conflict(environment,id) do update set code_key=excluded.code_key,doc=excluded.doc,
  photo=case when coalesce((item->>'photo_changed')::boolean,false) then excluded.photo else mtg_products.photo end,
  photo_version=case when coalesce((item->>'photo_changed')::boolean,false) then next_revision else mtg_products.photo_version end;
 end loop;
 for item in select value from jsonb_array_elements(p_events) loop
  insert into public.mtg_events(environment,id,doc,happened_at) values(p_environment,item->>'id',item,(item->>'at')::timestamptz) on conflict(environment,id) do nothing;
 end loop;
 if (select count(*) from public.mtg_products where environment=p_environment)>10000 then raise exception 'PRODUCT_LIMIT'; end if;
 update public.mtg_meta set revision=next_revision,updated_at=now() where environment=p_environment;
 insert into public.mtg_requests(environment,id,revision) values(p_environment,p_request_id,next_revision);
 return jsonb_build_object('revision',next_revision);
end $$;

create function public.mtg_finish_import(p_session uuid) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare source public.mtg_imports%rowtype; current_revision bigint; next_revision bigint; item jsonb;
begin
 select * into source from public.mtg_imports where id=p_session for update;
 if not found then raise exception 'IMPORT_NOT_FOUND'; end if;
 if source.applied_revision is not null then return jsonb_build_object('revision',source.applied_revision,'repeated',true); end if;
 if source.expires_at<now() then raise exception 'IMPORT_EXPIRED'; end if;
 select revision into current_revision from public.mtg_meta where environment=source.environment for update;
 if current_revision<>source.base_revision then raise exception using errcode='40001',message='REVISION_CONFLICT'; end if;
 if (select coalesce(sum(jsonb_array_length(items)),0) from public.mtg_import_chunks where session_id=p_session and kind='products')>10000 then raise exception 'PRODUCT_LIMIT'; end if;
 if (select coalesce(sum(jsonb_array_length(items)),0) from public.mtg_import_chunks where session_id=p_session and kind='events')>100000 then raise exception 'EVENT_LIMIT'; end if;
 next_revision:=current_revision+1;
 delete from public.mtg_products where environment=source.environment;
 delete from public.mtg_events where environment=source.environment;
 for item in select value from public.mtg_import_chunks c cross join lateral jsonb_array_elements(c.items) where c.session_id=p_session and c.kind='products' order by c.part loop
  insert into public.mtg_products(environment,id,code_key,doc,photo,photo_version) values(source.environment,item->'doc'->>'id',item->>'code_key',item->'doc',item->>'photo',next_revision);
 end loop;
 for item in select value from public.mtg_import_chunks c cross join lateral jsonb_array_elements(c.items) where c.session_id=p_session and c.kind='events' order by c.part loop
  insert into public.mtg_events(environment,id,doc,happened_at) values(source.environment,item->>'id',item,(item->>'at')::timestamptz);
 end loop;
 update public.mtg_meta set revision=next_revision,updated_at=now() where environment=source.environment;
 update public.mtg_imports set applied_revision=next_revision where id=p_session;
 delete from public.mtg_import_chunks where session_id=p_session;
 return jsonb_build_object('revision',next_revision);
end $$;

revoke all on function public.mtg_allow_login(text) from public,anon,authenticated;
revoke all on function public.mtg_commit(text,bigint,text,jsonb,jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.mtg_finish_import(uuid) from public,anon,authenticated;
grant execute on function public.mtg_allow_login(text) to service_role;
grant execute on function public.mtg_commit(text,bigint,text,jsonb,jsonb,jsonb) to service_role;
grant execute on function public.mtg_finish_import(uuid) to service_role;
