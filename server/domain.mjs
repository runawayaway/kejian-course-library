// Business API for the standalone container deployment.
import { env, catalog, legacy } from './runtime.mjs';
const allowedExtensions = new Set(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'csv', 'tsv', 'txt', 'md', 'zip', 'ipynb', 'c', 'cpp', 'h', 'java', 'py', 'sql', 'r', 'js', 'json']);
const bindings = env;
const database = () => { if (!env.DB)
    throw new Error('DB unavailable'); return env.DB; };
function fail(status, message) { throw Object.assign(new Error(message), { status }); }
const normalized = (s) => s.normalize('NFKC').replace(/\s+/g, '').toLowerCase();
const text = (v, max, required = false) => { if (typeof v !== 'string')
    return required ? fail(400, '请填写必填内容') : ''; const s = v.trim(); if (s.length > max)
    fail(400, `内容不能超过 ${max} 字`); if (required && !s)
    fail(400, '请填写必填内容'); return s; };
async function digest(value) { return [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))].map(b => b.toString(16).padStart(2, '0')).join(''); }
async function identity(request) {
    const key = request.headers.get('X-Device-Key') || '';
    if (key && !/^[a-f0-9]{64}$/.test(key))
        fail(401, '设备凭据无效，请刷新页面');
    const provided = request.headers.get('X-Admin-Key');
    return { owner: key ? await digest(key) : '', admin: !!bindings.ADMIN_KEY && provided === bindings.ADMIN_KEY };
}
function originAllowed(request) { const origin = request.headers.get('Origin'); const url = new URL(request.url); return !origin || origin === 'https://runawayaway.github.io' || origin === url.origin || /^http:\/\/(127\.0\.0\.1|localhost):(4173|8080|8088|5173)$/.test(origin); }
function headers(request) { const h = new Headers({ 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin' }); const origin = request.headers.get('Origin'); if (origin && originAllowed(request))
    h.set('Access-Control-Allow-Origin', origin); h.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS'); h.set('Access-Control-Allow-Headers', 'Content-Type,X-Device-Key,X-Admin-Key'); h.set('Access-Control-Max-Age', '600'); return h; }
function json(data, status = 200) { return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } }); }
async function rows() { return (await database().prepare('SELECT * FROM entries').all()).results; }
function decorate(row, who) { const d = JSON.parse(row.data); return { ...d, id: row.id, kind: row.kind, courseId: row.course_id, version: row.version, editable: who.admin || !!who.owner && row.owner_hash === who.owner, createdAt: row.created_at, updatedAt: row.updated_at, size: row.size, filename: row.filename }; }
function seeds() { return { courses: legacy.courses || [], records: legacy.records || [], resources: legacy.resources || [] }; }
async function readAll(request) {
    const who = await identity(request), stored = await rows(), seed = seeds();
    const live = new Map(stored.map(r => [r.id, r]));
    const records = seed.records.filter(r => !live.has(r.id)).map(r => ({ ...r, version: 0, editable: who.admin, imported: true }));
    const courses = seed.courses.filter((c) => !live.has(c.id)).map((c) => ({ ...c, version: 0, editable: who.admin }));
    const resources = seed.resources.filter((r) => !live.has(r.id)).map((r) => ({ ...r, version: 0, editable: who.admin }));
    const courseOverrides = [], reports = [], documents = [];
    for (const row of stored) {
        const d = decorate(row, who);
        if (d.deleted)
            continue;
        if (row.kind === 'document') {
            const { content, ...metadata } = d;
            documents.push(metadata);
        }
        else if (row.kind === 'report') {
            if (who.admin)
                reports.push(d);
        }
        else if (row.kind === 'experience')
            records.push(d);
        else if (row.kind === 'resource')
            resources.push(d);
        else if (catalog.some(c => c.id === row.id))
            courseOverrides.push(d);
        else
            courses.push(d);
    }
    return json({ repository: 'runawayaway/kejian-course-library', courses, records, resources, courseOverrides, reports, documents, baseEditable: who.admin, admin: who.admin });
}
async function lookup(id) {
    const row = await database().prepare('SELECT * FROM entries WHERE id=?').bind(id).first();
    if (row)
        return row;
    const seed = seeds(), record = seed.records.find(r => r.id === id), course = catalog.find(c => c.id === id) || seed.courses.find((c) => c.id === id);
    if (record)
        return { id, kind: 'experience', course_id: record.courseId, data: JSON.stringify({ ...record, imported: true }), owner_hash: null, version: 0, file_key: null, filename: null, size: 0, created_at: record.createdAt, updated_at: record.updatedAt };
    if (course)
        return { id, kind: 'course', course_id: id, data: JSON.stringify(course), owner_hash: null, version: 0, file_key: null, filename: null, size: 0, created_at: '', updated_at: '' };
    return null;
}
async function courseExists(id) { if (catalog.some(c => c.id === id))
    return true; const row = await lookup(id); return row?.kind === 'course' && !JSON.parse(row.data).deleted; }
async function rate(request) {
    const ip = request.headers.get('CF-Connecting-IP') || 'local';
    const hour = Math.floor(Date.now() / 3600000);
    const key = hour + ':' + await digest(ip);
    const r = await database().prepare('INSERT INTO rate_limits(id,count) VALUES(?,1) ON CONFLICT(id) DO UPDATE SET count=count+1 RETURNING count').bind(key).first();
    if ((r?.count || 0) > 150)
        fail(429, '提交较频繁，请稍后再试');
    // Keep only recent hourly buckets, not permanent visitor logs.
    await database().prepare('DELETE FROM rate_limits WHERE id < ?').bind(String(hour - 2) + ':').run();
}
async function payload(request) {
    const type = request.headers.get('Content-Type') || '';
    if (type.includes('multipart/form-data')) {
        const f = await request.formData();
        const data = JSON.parse(String(f.get('metadata') || '{}'));
        const file = f.get('file');
        return { data, file: file instanceof File ? file : null };
    }
    return { data: await request.json(), file: null };
}
async function validateFile(file) {
    if (!file.size)
        fail(400, '不能上传空文件');
    const filename = file.name.replace(/[\x00-\x1f\x7f/\\]/g, '_').slice(0, 180), ext = filename.split('.').pop()?.toLowerCase() || '';
    if (!allowedExtensions.has(ext))
        fail(400, '暂不支持该文件类型，请使用文档、代码或 ZIP 文件');
    const bytes = new Uint8Array(await file.slice(0, 8).arrayBuffer());
    if (ext === 'pdf' && new TextDecoder().decode(bytes.slice(0, 5)) !== '%PDF-')
        fail(400, '文件内容不是有效的 PDF 格式');
    if (['zip', 'docx', 'pptx', 'xlsx'].includes(ext) && !(bytes[0] === 80 && bytes[1] === 75))
        fail(400, '文件内容与扩展名不一致');
    if (['doc', 'ppt', 'xls'].includes(ext) && !(bytes[0] === 208 && bytes[1] === 207))
        fail(400, '文件内容与扩展名不一致');
    return { filename, ext };
}
async function save(request, id) {
    const who = await identity(request);
    if (!who.owner && !who.admin)
        fail(401, '设备凭据缺失，请刷新后重试');
    await rate(request);
    const { data: input, file } = await payload(request);
    const old = id ? await lookup(id) : null;
    if (id && !old)
        fail(404, '内容不存在');
    if (old && !who.admin && old.owner_hash !== who.owner)
        fail(403, '只能修改本浏览器发布的内容；历史内容由维护者管理');
    const kind = (old?.kind || input.kind);
    if (!['course', 'experience', 'resource', 'report'].includes(kind))
        fail(400, '内容类型无效');
    if (old && Number(input.version) !== old.version)
        fail(409, '内容已被修改，请刷新后再编辑');
    const previous = old ? JSON.parse(old.data) : {};
    const entryId = old?.id || crypto.randomUUID();
    let courseId = kind === 'course' ? entryId : text(input.courseId, 150, true);
    if (kind !== 'course' && !await courseExists(courseId))
        fail(400, '请先选择已有课程');
    let data, key = old?.file_key || null, filename = old?.filename || null, size = old?.size || 0, newKey = null;
    if (kind === 'course') {
        const name = text(input.name, 100, true), description = text(input.content, 3000);
        const all = [...catalog, ...(await rows()).filter(r => r.kind === 'course' && !JSON.parse(r.data).deleted).map(r => ({ ...JSON.parse(r.data), id: r.id }))];
        if (all.some(c => c.id !== entryId && normalized(c.name) === normalized(name)))
            fail(409, '这门课已经存在，请直接补充资料或经验');
        data = { ...previous, id: entryId, name, description: description || '同学添加的课程，欢迎补充资料与经验。', college: previous.college || '同学新增课程', sourceType: previous.sourceType || 'community', resources: [], experiences: [], tags: previous.tags || [], status: '同学共建', accepted: false };
    }
    else if (kind === 'experience') {
        const body = text(input.content, 10000, true), teacher = text(input.teacher, 40) || '未注明', semester = text(input.semester, 40) || '未注明';
        data = { ...previous, id: entryId, courseId, body, teacher, semester, title: previous.title || '修课经验', author: previous.author || text(input.author, 30) || '同学', status: old?.owner_hash === null ? '维护者更新' : '同学投稿', accepted: who.admin, teaching: true };
    }
    else if (kind === 'report') {
        if (old)
            fail(400, '反馈请由维护者在管理页面处理');
        const targetId = text(input.targetId, 150), target = targetId ? await lookup(targetId) : null;
        if (targetId && (!target || target.kind === 'report' || JSON.parse(target.data).deleted || target.course_id !== courseId))
            fail(400, '反馈对象不存在或不属于这门课');
        const sourceUrl = text(input.sourceUrl, 2000);
        if (sourceUrl && !/^https?:\/\//.test(sourceUrl))
            fail(400, '资料来源地址无效');
        data = { id: entryId, courseId, targetId, targetTitle: target ? JSON.parse(target.data).title || JSON.parse(target.data).name || '修课经验' : text(input.targetTitle, 200, true), sourceUrl, reason: text(input.content, 2000, true), status: 'open' };
    }
    else {
        if (!file && !old)
            fail(400, '请选择要上传的文件');
        const description = text(input.content, 3000);
        const category = text(input.category, 20) || previous.category || '其他';
        if (!['学习笔记', '实验参考', '复习资料', '其他'].includes(category))
            fail(400, '资料分类无效');
        const teacher = text(input.teacher, 40) || '未注明', semester = text(input.semester, 40) || '未注明';
        if (file) {
            const validated = await validateFile(file);
            filename = validated.filename;
            size = file.size;
            const total = await database().prepare('SELECT COALESCE(SUM(size),0) AS total FROM entries').first();
            if ((total?.total || 0) - (old?.size || 0) + size > 1024 * 1024 * 1024)
                fail(507, '文件存储空间不足，请联系维护者');
            key = 'uploads/' + crypto.randomUUID();
            newKey = key;
            if (!env.BUCKET)
                throw new Error('BUCKET unavailable');
            await env.BUCKET.put(key, file.stream(), { httpMetadata: { contentType: 'application/octet-stream' } });
        }
        data = { id: entryId, courseId, title: filename, description, category, teacher, semester, format: filename?.split('.').pop()?.toUpperCase() || 'FILE', source: previous.source || '同学上传', permission: '以原作者说明为准', status: '同学上传', accepted: who.admin, uploaded: true, downloadPath: '/api/files/' + entryId, variants: [] };
    }
    const now = new Date().toISOString(), version = (old?.version || 0) + 1;
    try {
        if (old && old.version > 0) {
            const result = await database().prepare('UPDATE entries SET data=?,course_id=?,version=?,file_key=?,filename=?,size=?,updated_at=? WHERE id=? AND version=?').bind(JSON.stringify(data), courseId, version, key, filename, size, now, entryId, old.version).run();
            if (!result.meta.changes)
                fail(409, '内容已被修改，请刷新后再编辑');
        }
        else {
            await database().prepare('INSERT INTO entries(id,kind,course_id,data,owner_hash,version,file_key,filename,size,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(entryId, kind, courseId, JSON.stringify(data), old ? old.owner_hash : who.owner, version, key, filename, size, old?.created_at || now, now).run();
        }
    }
    catch (error) {
        if (newKey)
            await env.BUCKET?.delete(newKey);
        throw error;
    }
    if (old) {
        try {
            await database().prepare('INSERT INTO revisions(id,entry_id,version,data,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(), entryId, old.version, old.data, now).run();
            if (newKey && old.file_key)
                await env.BUCKET?.delete(old.file_key);
        }
        catch { }
    }
    return json({ id: entryId, courseId, version, kind, record: { ...data, id: entryId, courseId, version, kind, editable: true, filename, size, createdAt: old?.created_at || now, updatedAt: now } }, old ? 200 : 201);
}
async function remove(request, id) {
    const who = await identity(request), old = await lookup(id);
    if (!old)
        fail(404, '内容不存在');
    if (!who.admin && (!who.owner || old.owner_hash !== who.owner))
        fail(403, '无权删除该内容');
    if (old.kind === 'course') {
        if (catalog.some(c => c.id === id))
            fail(400, '基础课程不能删除');
        const children = await database().prepare("SELECT COUNT(*) AS total FROM entries WHERE course_id=? AND id<>? AND kind<>'report' AND COALESCE(json_extract(data,'$.deleted'),0)<>1").bind(id, id).first();
        if (children?.total)
            fail(409, '课程还有资料或经验，不能直接删除');
    }
    const data = JSON.stringify({ ...JSON.parse(old.data), deleted: true });
    if (old.version === 0)
        await database().prepare('INSERT INTO entries(id,kind,course_id,data,owner_hash,version,size,created_at,updated_at) VALUES(?,?,?,?,?,1,0,?,?)').bind(id, old.kind, old.course_id, data, null, new Date().toISOString(), new Date().toISOString()).run();
    else
        await database().prepare('UPDATE entries SET data=?,size=0,version=version+1,updated_at=? WHERE id=?').bind(data, new Date().toISOString(), id).run();
    if (old.file_key)
        await env.BUCKET?.delete(old.file_key);
    return json({ deleted: true });
}
async function moderate(request, id) {
    const who = await identity(request), { data: input } = await payload(request);
    if (!who.admin)
        fail(403, '需要维护者权限');
    const old = await lookup(id);
    if (!old || JSON.parse(old.data).deleted)
        fail(404, '内容不存在');
    if (Number(input.version) !== old.version)
        fail(409, '内容已更新，请刷新后操作');
    const data = JSON.parse(old.data);
    if (old.kind === 'report') {
        if (!['open', 'resolved'].includes(input.status))
            fail(400, '反馈状态无效');
        data.status = input.status;
    }
    else {
        if (typeof input.accepted !== 'boolean')
            fail(400, '核实状态无效');
        data.accepted = input.accepted;
        data.status = input.accepted ? '维护者已核实' : '待核实';
    }
    const now = new Date().toISOString();
    if (old.version === 0)
        await database().prepare('INSERT INTO entries(id,kind,course_id,data,owner_hash,version,size,created_at,updated_at) VALUES(?,?,?,?,?,1,0,?,?)').bind(id, old.kind, old.course_id, JSON.stringify(data), null, old.created_at || now, now).run();
    else {
        const result = await database().prepare('UPDATE entries SET data=?,version=version+1,updated_at=? WHERE id=? AND version=?').bind(JSON.stringify(data), now, id, old.version).run();
        if (!result.meta.changes)
            fail(409, '内容已更新，请刷新后操作');
    }
    await database().prepare('INSERT INTO revisions(id,entry_id,version,data,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(), id, old.version, old.data, now).run();
    return json({ saved: true });
}
async function saveDocument(request) {
    const who = await identity(request);
    if (!who.admin)
        fail(403, '修改共享原文需要维护者权限');
    await rate(request);
    const { data: input } = await payload(request), courseId = text(input.courseId, 150, true), sourceUrl = text(input.sourceUrl, 2000, true);
    if (!await courseExists(courseId))
        fail(400, '课程不存在');
    if (!/^materials\/[a-z0-9_./-]+\.md$/i.test(sourceUrl) && !/^https:\/\//.test(sourceUrl))
        fail(400, '原文地址无效');
    const id = 'doc-' + await digest(courseId + '\n' + sourceUrl), old = await lookup(id);
    if (old && old.kind !== 'document')
        fail(409, '记录类型冲突');
    if (Number(input.version) !== (old?.version || 0))
        fail(409, '原文已被修改，请刷新预览后再编辑；你的草稿已保留');
    if (typeof input.content !== 'string' || !input.content.trim())
        fail(400, '原文不能为空');
    if (new TextEncoder().encode(input.content).length > 100000)
        fail(400, '在线编辑支持不超过 100 KB 的原文');
    const now = new Date().toISOString(), version = (old?.version || 0) + 1;
    const data = { id, courseId, sourceUrl, title: text(input.title, 200, true), content: input.content, format: 'MD', downloadPath: '/api/documents/' + id };
    if (old) {
        const result = await database().prepare('UPDATE entries SET data=?,version=?,size=?,updated_at=? WHERE id=? AND version=?').bind(JSON.stringify(data), version, 0, now, id, old.version).run();
        if (!result.meta.changes)
            fail(409, '原文已被修改，请刷新后再试；你的草稿已保留');
        await database().prepare('INSERT INTO revisions(id,entry_id,version,data,created_at) VALUES(?,?,?,?,?)').bind(crypto.randomUUID(), id, old.version, old.data, now).run();
    }
    else {
        try {
            await database().prepare('INSERT INTO entries(id,kind,course_id,data,owner_hash,version,size,created_at,updated_at) VALUES(?,?,?,?,?,1,0,?,?)').bind(id, 'document', courseId, JSON.stringify(data), null, now, now).run();
        }
        catch (error) {
            if (await lookup(id))
                fail(409, '原文已被修改，请刷新后再试；你的草稿已保留');
            throw error;
        }
    }
    return json({ id, version, record: { ...data, version, editable: true, updatedAt: now } }, old ? 200 : 201);
}
async function readDocument(id) {
    const row = await lookup(id);
    if (!row || row.kind !== 'document')
        fail(404, '修订原文不存在');
    const data = JSON.parse(row.data);
    if (data.deleted)
        fail(404, '修订原文不存在');
    return new Response(data.content, { headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Content-Disposition': `attachment; filename="revision.md"; filename*=UTF-8''${encodeURIComponent(data.title.replace(/\.md$/i, '') + '.md')}`, 'Cache-Control': 'no-store' } });
}
export async function handle(request) {
    let response;
    try {
        if (!originAllowed(request))
            return json({ error: '不允许此来源' }, 403);
        const path = new URL(request.url).pathname, method = request.method;
        if (method === 'OPTIONS')
            response = new Response(null, { status: 204 });
        else if (path === '/api/health' && method === 'GET') {
            await database().prepare('SELECT 1').first();
            response = json({ ready: !!env.BUCKET });
        }
        else if (path === '/api/contributions' && method === 'GET')
            response = await readAll(request);
        else if (path === '/api/documents' && method === 'PUT')
            response = await saveDocument(request);
        else if (/^\/api\/documents\/doc-[a-f0-9]{64}$/.test(path) && method === 'GET')
            response = await readDocument(path.split('/').pop());
        else if (path === '/api/entries' && method === 'POST')
            response = await save(request);
        else if (/^\/api\/entries\/[^/]+$/.test(path) && method === 'PUT')
            response = await save(request, decodeURIComponent(path.split('/').pop()));
        else if (/^\/api\/entries\/[^/]+$/.test(path) && method === 'DELETE')
            response = await remove(request, decodeURIComponent(path.split('/').pop()));
        else if (/^\/api\/moderation\/[^/]+$/.test(path) && method === 'POST')
            response = await moderate(request, decodeURIComponent(path.split('/').pop()));
        else if (/^\/api\/files\/[^/]+$/.test(path) && method === 'GET') {
            const row = await lookup(decodeURIComponent(path.split('/').pop()));
            if (!row?.file_key || JSON.parse(row.data).deleted)
                fail(404, '文件不存在');
            const object = await env.BUCKET?.get(row.file_key);
            if (!object)
                fail(404, '文件不存在');
            response = new Response(object.body, { headers: { 'Content-Type': 'application/octet-stream', 'Content-Disposition': `attachment; filename="download.${row.filename?.split('.').pop() || 'bin'}"; filename*=UTF-8''${encodeURIComponent(row.filename || 'download')}`, 'Content-Length': String(object.size), 'Cache-Control': 'public, max-age=3600' } });
        }
        else
            response = json({ error: '接口不存在' }, 404);
    }
    catch (error) {
        const e = error;
        response = json({ error: e.status ? e.message : '保存服务暂不可用，请稍后重试' }, e.status || 500);
    }
    const cors = headers(request);
    for (const [k, v] of cors)
        if (k !== 'cache-control' || !response.headers.has(k))
            response.headers.set(k, v);
    return response;
}
