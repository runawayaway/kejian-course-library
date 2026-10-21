/* Public contribution parsing, shared by the website and snapshot script. */
(function (root) {
  'use strict';
  const nameKey = name => String(name || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();
  const labels = issue => (issue.labels || []).map(l => typeof l === 'string' ? l : l.name);
  const hidden = issue => issue.pull_request || labels(issue).some(l => ['不予收录','rejected','隐藏'].includes(l));
  const accepted = issue => issue.author_association === 'OWNER' || labels(issue).some(l => ['已收录','approved','accepted'].includes(l));
  const status = issue => issue.author_association === 'OWNER' ? '维护者投稿' : accepted(issue) ? '已收录' : '待核实';
  function section(body, heading) {
    if(heading==='具体内容'){
      const content=body.match(/^##\s+具体内容\s*\r?\n([\s\S]*)$/m)?.[1]||'';
      return content.replace(/\r?\n##\s+资料信息\s*\r?\n[\s\S]*$/,'').replace(/\r?\n---\s*\r?\n由课间投稿表单生成[\s\S]*$/,'').trim();
    }
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = body.match(new RegExp('^##\\s+' + escaped + '\\s*\\r?\\n([\\s\\S]*?)(?=^##\\s|^---\\s*$|(?![\\s\\S]))', 'm'));
    return match ? match[1].trim() : '';
  }
  function field(issue, name) { return (issue.body || '').match(new RegExp('^[-*]\\s*' + name + '[：:]\\s*(.+)$', 'm'))?.[1].trim() || ''; }
  function kind(issue, type) { return new RegExp('^\\[(' + type + ')\\]').test(issue.title || '') || new RegExp('^##\\s+(' + type + ')\\s*$', 'm').test(issue.body || ''); }
  function source(issue, repository) {
    return {id:`issue-${issue.number}`,number:issue.number,author:issue.user?.login||'GitHub 用户',createdAt:issue.created_at,updatedAt:issue.updated_at||issue.created_at,url:`https://github.com/${repository}/issues/${issue.number}`,accepted:accepted(issue),status:status(issue)};
  }
  function courseFor(issue, courses) {
    const id=field(issue,'课程ID');
    const name=field(issue,'课程')||section(issue.body||'','课程名称');
    return courses.find(c=>c.id===id)||courses.find(c=>nameKey(c.name)===nameKey(name));
  }
  function parseIssue(issue, courses, repository) {
    if(hidden(issue)||!kind(issue,'修课经验|授课与考核'))return null;
    const course=courseFor(issue,courses),body=section(issue.body||'','具体内容');
    if(!course||!body)return null;
    const topics=field(issue,'内容包含');
    return {...source(issue,repository),courseId:course.id,title:(issue.title||'').replace(/^\[[^\]]+\]\s*/,''),body,teacher:field(issue,'授课教师')||'未注明',semester:field(issue,'学期')||'未注明',teaching:!topics||/授课|考核/.test(topics)};
  }
  function safeLink(value) { try {const u=new URL(value);return ['http:','https:'].includes(u.protocol)&&!u.username&&!u.password?u.href:'';}catch{return '';} }
  function parseResource(issue,courses,repository) {
    if(hidden(issue)||!kind(issue,'分享资料'))return null;
    const course=courseFor(issue,courses),url=safeLink(field(issue,'链接'));
    if(!course||!url)return null;
    const meta=source(issue,repository);
    return {...meta,issueUrl:meta.url,courseId:course.id,url,title:(issue.title||'').replace(/^\[[^\]]+\]\s*/,''),description:section(issue.body||'','具体内容')||'同学分享的资料链接',source:'@'+meta.author,permission:'请参照原作者说明',format:'LINK',kind:'同学分享',variants:[]};
  }
  function collectIssues(issues,baseCourses,repository) {
    const courses=[],all=[...baseCourses];
    const sorted=[...issues].sort((a,b)=>a.number-b.number);
    for(const issue of sorted){
      if(hidden(issue)||!kind(issue,'新增课程'))continue;
      const name=field(issue,'课程')||section(issue.body||'','课程名称');
      if(!name||name.length>100||all.some(c=>nameKey(c.name)===nameKey(name)))continue;
      const meta=source(issue,repository);
      const c={...meta,id:`student-${issue.number}`,issueId:meta.id,issueUrl:meta.url,name,college:field(issue,'学院')||'学院未注明',category:'同学新增',description:section(issue.body||'','具体内容')||'同学添加的课程，欢迎补充资料和修课经验。',sourceType:'community',resources:[],experiences:[],tags:[],sourceUrl:meta.url};
      courses.push(c);all.push(c);
    }
    return {courses,records:sorted.map(i=>parseIssue(i,all,repository)).filter(Boolean),resources:sorted.map(i=>parseResource(i,all,repository)).filter(Boolean)};
  }
  root.CourseCommunity={parseIssue,collectIssues,nameKey,safeLink};
})(typeof window!=='undefined'?window:globalThis);
