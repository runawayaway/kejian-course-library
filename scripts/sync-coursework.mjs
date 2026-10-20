import { execFileSync } from 'node:child_process';
import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const repo = 'runawayaway/NWAFU-coursework-experimental-report';
const gh = process.env.GH_BIN || (process.platform === 'win32' ? 'C:/Program Files/GitHub CLI/gh.exe' : 'gh');
const api = endpoint => JSON.parse(execFileSync(gh, ['api', endpoint], { encoding: 'utf8', maxBuffer: 16e6 }));
const info = api(`repos/${repo}`);
const commit = api(`repos/${repo}/commits/${info.default_branch}`);
const snapshot = api(`repos/${repo}/git/trees/${commit.sha}?recursive=1`);
if (snapshot.truncated) throw new Error('目录树不完整，停止同步以避免丢失课程。');
const metadata = [
  ['java','Java程序设计','面向对象、异常处理、API、GUI、输入输出流与集合类相关实验。',['Java','面向对象','GUI']],
  ['linux-project','Linux实习','简单 Web 服务器的设计与实现，含实习论文、计划书、答辩和代码。',['Linux','Web服务器','C语言']],
  ['linux-programming','linux程序设计','Linux 程序设计实验与知识点梳理，涵盖命令、Shell、文件 IO 和进程。',['Linux','Shell','进程']],
  ['cloud-computing','云计算','云计算课程实验资料，提供实验 2 至实验 5 的文档。',['云计算','实验报告']],
  ['data-visualization','大数据可视化','可视化实验、Python 绘图资料，以及数据集与 Tableau 工作簿。',['Python','可视化','Tableau']],
  ['data-storage','大数据存储与管理','MongoDB、Redis 与 Cassandra 数据库实践资料。',['MongoDB','Redis','Cassandra']],
  ['data-collection','大数据采集与清洗','网络爬虫与 Kafka、Kettle、Flume 的实践资料。',['Kafka','Flume','爬虫']],
  ['parallel-computing','并行计算','并行计算课程实验二至实验五的报告文档。',['并行计算','实验报告']],
  ['operating-systems','操作系统','进程调度、作业调度、存储管理与文件系统实验及代码。',['进程调度','存储管理','C语言']],
  ['database','数据库','数据库课程五次实习报告，按源仓库课程目录单独收录。',['数据库','实习报告']],
  ['database-project','数据库实习','电脑零件进销存管理系统的计划、论文、汇报与相关文件。',['数据库','管理系统','项目实践']],
  ['database-systems','数据库系统概论','数据库系统概论实验 1 至实验 5，包含 PDF 与 Word 格式。',['数据库','SQL','实验报告']],
  ['data-science-intro','数据科学与大数据导论','数据科学导论结课演示与大模型使用记录。',['数据科学','大模型','课程汇报']],
  ['structures-project','数据结构实习','学籍管理系统课程实践，包含实习论文、计划、汇报与源代码。',['数据结构','学籍管理系统','项目实践']],
  ['machine-learning','机器学习','线性回归、感知机、神经网络、SVM 与朴素贝叶斯实验。',['机器学习','分类','回归']],
  ['data-mining','机器学习与数据挖掘','回归预测分析实验报告及项目相关文件。',['数据挖掘','回归预测']],
  ['stream-computing','流式计算','流式计算实验 1 至实验 4 与实验模板。',['流式计算','实验报告','模板']],
  ['deep-learning','深度学习','深度学习实验三、四、五的文档与课程相关文件。',['深度学习','实验报告']],
  ['algorithms-project','算法实习','收集样本问题的分析与解决，包含论文、计划书、答辩和代码。',['算法','项目实践']],
  ['algorithms','算法设计与分析','分治、动态规划、贪心、回溯、分支限界与随机化算法实验。',['动态规划','贪心','算法']],
  ['compiler','编译原理','词法分析、语法分析和语义分析实习文档与实现代码。',['词法分析','语法分析','编译器']],
  ['compiler-project','编译原理实习','使用 JavaCC 开发 MiniC 语言编译器的课程实践。',['JavaCC','MiniC','编译器']],
  ['software-architecture','软件体系结构','软件体系结构实习一至实习四的实验文档与相关文件。',['软件体系结构','实验报告']]
];
const folders = snapshot.tree.filter(f => f.type === 'tree' && !f.path.includes('/')).map(f => f.path);
const known = new Set(metadata.map(m => m[1]));
for (const name of folders) if (!known.has(name)) throw new Error(`发现新课程目录「${name}」，请先补充 metadata 的课程简介与 ID，再重新同步。`);
const base = `https://github.com/${repo}`;
const encoded = p => p.split('/').map(encodeURIComponent).join('/');
const fileUrl = p => `${base}/blob/${commit.sha}/${encoded(p)}`;
const courses = metadata.map(([id, name, description, tags], index) => {
  if (!folders.includes(name)) throw new Error(`源仓库已没有「${name}」，请核实目录变更。`);
  const files = snapshot.tree.filter(f => f.type === 'blob' && f.path.startsWith(name + '/'));
  const groups = new Map();
  for (const f of files.filter(f => /\.(pdf|docx?|pptx?|ipynb)$/i.test(f.path))) {
    const key = f.path.replace(/\.[^.]+$/, '');
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }
  const resources = [...groups.values()].map(variants => {
    const priority = {pdf:0, docx:1, doc:2, pptx:3, ppt:4, ipynb:5};
    variants.sort((a,b)=>priority[a.path.split('.').pop().toLowerCase()]-priority[b.path.split('.').pop().toLowerCase()]);
    const file = variants[0];
    const relative = file.path.slice(name.length + 1);
    const format = file.path.split('.').pop().toUpperCase();
    return {title:relative.replace(/\.[^.]+$/, '').replaceAll('/', ' / '),kind:/模板/.test(relative)?'实验模板':/知识点/.test(relative)?'知识梳理':/ppt/i.test(format)||/答辩|汇报/.test(relative)?'课程汇报':'实验与作业',format,
      description:`原仓库文件：${relative}。文件内容与适用要求请查看原文。`,url:fileUrl(file.path),sourcePath:file.path,source:'runawayaway 与源仓库贡献者',permission:'仅链接原仓库；使用权限以原作者说明为准',
      variants:variants.slice(1).map(v=>({format:v.path.split('.').pop().toUpperCase(),url:fileUrl(v.path),sourcePath:v.path})),size:file.size};
  });
  resources.push({title:'完整课程目录（含代码与附件）',kind:'项目目录',format:'DIR',description:`查看原仓库本课程的全部 ${files.length} 个文件，包含文档及可能的代码、数据和附件。`,url:`${base}/tree/${commit.sha}/${encoded(name)}`,source:'runawayaway 与源仓库贡献者',permission:'仅链接原仓库；使用权限以原作者说明为准'});
  return {id,name,code:'未提供',college:'信息工程学院',category:name.includes('实习')?'课程实习':'课程资料',credits:null,icon:['▣','⌘','◎','∫','¶'][index%5],color:['blue','green','orange','purple','rose'][index%5],description,tags,
    prerequisites:'原仓库未提供，请以课程大纲为准。',overview:`${description} 本页简介根据原仓库目录及文件名整理，未将文档内容转换为教学大纲。`,teacher:'未提供',semester:'未提供',assessment:'原仓库未提供考核方式，请参考当学期任课教师要求。',style:'暂无经过核实的授课情况，欢迎修过本课程的同学补充教师与学期。',workload:'未提供',sourceType:'repository',sourceUrl:`${base}/tree/${commit.sha}/${encoded(name)}`,fileCount:files.length,resources,experiences:[],questions:[]};
});
const config = {name:'课间',repository:'runawayaway/kejian-course-library',school:'西北农林科技大学 · 课程共享计划',sourceRepository:repo,sourceRevision:commit.sha,sourceUpdatedAt:commit.commit.committer.date,documentCount:courses.reduce((n,c)=>n+c.resources.filter(r=>r.format!=='DIR').length,0)};
await writeFile(fileURLToPath(new URL('../data/courses.js',import.meta.url)), '// 由 npm run sync 生成。课程概述在 scripts/sync-coursework.mjs 维护；未知授课信息不作推测。\nwindow.SITE_CONFIG = '+JSON.stringify(config,null,2)+';\nwindow.COURSES = '+JSON.stringify(courses,null,2)+';\n');
console.log(`已同步 ${courses.length} 门课程、${config.documentCount} 组文档、${courses.reduce((n,c)=>n+c.fileCount,0)} 个源文件；同名不同格式已归组。源版本 ${commit.sha}`);
