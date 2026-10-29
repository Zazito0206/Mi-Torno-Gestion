create or replace function public.mtg_commit(p_environment text,p_base_revision bigint,p_request_id text,p_upserts jsonb,p_deletes jsonb,p_events jsonb) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare current_revision bigint; next_revision bigint; previous_revision bigint; item jsonb;
begin
 select revision into current_revision from public.mtg_meta where environment=p_environment for update;
 if not found then raise exception 'INVALID_ENVIRONMENT'; end if;
 select revision into previous_revision from public.mtg_requests where environment=p_environment and id=p_request_id;
 if found then return jsonb_build_object('revision',previous_revision,'repeated',true); end if;
 if current_revision<>p_base_revision then raise exception using errcode='PT409',message='REVISION_CONFLICT'; end if;
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

create or replace function public.mtg_finish_import(p_session uuid) returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare source public.mtg_imports%rowtype; current_revision bigint; next_revision bigint; item jsonb;
begin
 select * into source from public.mtg_imports where id=p_session for update;
 if not found then raise exception 'IMPORT_NOT_FOUND'; end if;
 if source.applied_revision is not null then return jsonb_build_object('revision',source.applied_revision,'repeated',true); end if;
 if source.expires_at<now() then raise exception 'IMPORT_EXPIRED'; end if;
 select revision into current_revision from public.mtg_meta where environment=source.environment for update;
 if current_revision<>source.base_revision then raise exception using errcode='PT409',message='REVISION_CONFLICT'; end if;
 if (select coalesce(sum(jsonb_array_length(items)),0) from public.mtg_import_chunks where session_id=p_session and kind='products')>10000 then raise exception 'PRODUCT_LIMIT'; end if;
 if (select coalesce(sum(jsonb_array_length(items)),0) from public.mtg_import_chunks where session_id=p_session and kind='events')>100000 then raise exception 'EVENT_LIMIT'; end if;
 if (select coalesce(sum(jsonb_array_length(items)),0) from public.mtg_import_chunks where session_id=p_session and kind='products')<>source.product_count or (select coalesce(sum(jsonb_array_length(items)),0) from public.mtg_import_chunks where session_id=p_session and kind='events')<>source.event_count then raise exception 'INCOMPLETE_IMPORT'; end if;
 next_revision:=current_revision+1;
 delete from public.mtg_products where environment=source.environment;
 delete from public.mtg_events where environment=source.environment;
 for item in select value from public.mtg_import_chunks c cross join lateral jsonb_array_elements(c.items) where c.session_id=p_session and c.kind='products' order by c.part loop
  insert into public.mtg_products(environment,id,code_key,doc,photo,photo_version) values(source.environment,item->'doc'->>'id',item->>'code_key',item->'doc',item->>'photo',case when item->>'photo' is null then 0 else next_revision end);
 end loop;
 for item in select value from public.mtg_import_chunks c cross join lateral jsonb_array_elements(c.items) where c.session_id=p_session and c.kind='events' order by c.part loop
  insert into public.mtg_events(environment,id,doc,happened_at) values(source.environment,item->>'id',item,(item->>'at')::timestamptz);
 end loop;
 update public.mtg_meta set revision=next_revision,updated_at=now() where environment=source.environment;
 update public.mtg_imports set applied_revision=next_revision where id=p_session;
 delete from public.mtg_import_chunks where session_id=p_session;
 return jsonb_build_object('revision',next_revision);
end $$;

