/* Shared parser for public GitHub contributions; no credentials in the browser. */
(function (root) {
  'use strict';
  function section(body, heading) {
    const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const match = body.match(new RegExp('^##\\s+' + escaped + '\\s*\\r?\\n([\\s\\S]*?)(?=^##\\s|^---\\s*$|(?![\\s\\S]))', 'm'));
    return match ? match[1].trim() : '';
  }
  function parseIssue(issue, courses, repository) {
    if (issue.pull_request || issue.labels?.some(l => ['不予收录', 'rejected', '隐藏'].includes(typeof l === 'string' ? l : l.name))) return null;
    const body = issue.body || '';
    const field = name => body.match(new RegExp('^[-*]\\s*' + name + '[：:]\\s*(.+)$', 'm'))?.[1].trim() || '';
    const name = field('课程') || section(body, '课程名称');
    const course = courses.find(c => c.name === name || c.id === name);
    const isExperience = /^\[(修课经验|授课与考核)\]/.test(issue.title || '') || /^##\s+(修课经验|授课与考核)\s*$/m.test(body);
    if (!course || !isExperience) return null;
    const content = section(body, '具体内容');
    if (!content) return null;
    const labels = (issue.labels || []).map(l => typeof l === 'string' ? l : l.name);
    const accepted = issue.author_association === 'OWNER' || labels.some(l => ['已收录', 'approved', 'accepted'].includes(l));
    const topics = field('内容包含');
    const teaching = !topics || /授课|考核/.test(topics); // Legacy experiences may describe teaching/assessment too.
    return { id: `issue-${issue.number}`, number: issue.number, courseId: course.id,
      title: (issue.title || '').replace(/^\[[^\]]+\]\s*/, ''), body: content,
      teacher: field('授课教师') || '未注明', semester: field('学期') || '未注明',
      author: issue.user?.login || 'GitHub 用户', createdAt: issue.created_at, updatedAt: issue.updated_at || issue.created_at,
      url: `https://github.com/${repository}/issues/${issue.number}`, accepted, teaching,
      status: issue.author_association === 'OWNER' ? '维护者投稿' : accepted ? '已收录' : '待核实投稿' };
  }
  root.CourseCommunity = { parseIssue };
})(typeof window !== 'undefined' ? window : globalThis);
