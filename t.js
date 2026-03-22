const axios = require('axios'),cheerio = require('cheerio')
const fs = require('fs'),path=require('path')
const v2uri = require('./lib/v2uri')
const socksAgent = process.env.PROXY ? (new (require('socks-proxy-agent').SocksProxyAgent)(process.env.proxy)) : undefined //代理

let d = new Date()
const yyyy=d.getFullYear(),mm = String(d.getMonth() + 1).padStart(2, '0'),dd= String(d.getDate()).padStart(2, '0');

function safeJson(s){return JSON.parse(s)}//暂代
function fromBase64(bstr){return Buffer.from(bstr.trim(), 'base64').toString('utf-8')}

function extractUrlsSmart(html) {
  const $ = cheerio.load(html);
  const urlPattern = /[a-zA-Z][a-zA-Z0-9+\-.]*:\/\/[^\s"'<>]+/g;
  
  // 先移除所有不希望提取内容的标签
  $('script, style, noscript').remove();
  
  // 获取所有文本内容
  const text = $('body').text();
  
  // 提取URL并去重
  const urls = [...new Set(text.match(urlPattern) || [])];
  
  return urls;
}

async function updateData() {
	let allTxt = '',allLogs=''
	/////////////////普通base64订阅链接或包含节点URL的纯文本，按是否包含:判断是否需要base64解码
	const suburls=[
		'https://raw.githubusercontent.com/free18/v2ray/refs/heads/main/v.txt',
		'https://www.xrayvip.com/free.txt',
		`https://node.nodefree.me/${yyyy}/${mm}/${yyyy}${mm}${dd}.txt`,
		'https://github.com/Alvin9999-newpac/fanqiang/wiki/v2ray%E5%85%8D%E8%B4%B9%E8%B4%A6%E5%8F%B7',
		'https://raw.githubusercontent.com/shaoyouvip/free/refs/heads/main/base64.txt',
		`https://node.hysteria2.org/uploads/${yyyy}/${mm}/0-${yyyy}${mm}${dd}.txt`,`https://node.hysteria2.org/uploads/${yyyy}/${mm}/1-${yyyy}${mm}${dd}.txt`,//https://hysteria2.org/free-node/2026-2-27-free-clash-subscribe.htm
		
		`https://node.freeclashnode.com/uploads/${yyyy}/${mm}/0-${yyyy}${mm}${dd}.txt`,//freeclashnode.com
	]

	suburls.unshift(...(await loadShareSite())) //分享站点
	suburls.unshift(...(await loadYoutubeSbj('UUtzk4Wh7dwJLDKXbq4w4PRQ',/https:\/\/us1\.zhuk\.dpdns\.org\/[^/\s]+\outube.html/g , /https:\/\/vess\.zhuk\.dpdns\.org\/\S+?\.txt/g)))

	console.log('处理zzzhhh1项目7z')
	allTxt += await loadGitCustom() + '\n' //7z打包的
	
	for(const u of suburls){
		try{
			allLogs += '开始加载'+u+'\n'
			let d = (await axios.get(u,{httpsAgent:socksAgent})).data
			
			let txt1 = ''
			if(d.indexOf(':/')<0) txt1 = fromBase64(d) //base64订阅直接解码
			else for(const u1 of extractUrlsSmart(d)) if(!u1.startsWith('http'))txt1 += u1.trim()+'\n' //解析所有URL
			
			txt1 = txt1.trim()
			allLogs += txt1 + '\n'
			allTxt += txt1 + '\n'

			console.log(u,'读取后长度', allTxt.length);
		}
		catch (error) {console.error(u,'读取失败:', error.message);}
	}

	allTxt = allTxt.trim()
	fs.writeFileSync('vsrc', Buffer.from(allTxt).toString('base64')) //原始完整列表

	let uniList={},allcnt=0
	for(let urlstr of allTxt.trim().split('\n'))if(urlstr.length>9){
		let v = new v2uri(urlstr)
		if(!v) continue
		uniList[v.FP] = urlstr
		++allcnt
	}

	allTxt = '',ucnt=0
	for(let h in uniList){
		allTxt += uniList[h]+'\n'
		++ucnt
	}

	console.log('总长度',allTxt.length,'总数', allcnt,'去重后',ucnt)
	fs.writeFileSync('vt', allTxt) //订阅明文
	fs.writeFileSync('v', Buffer.from(allTxt).toString('base64')) //去重后的订阅
	fs.writeFileSync('l', allLogs) //日志

	////////////////////////////////金融数据
	let allTickers=[]
	
	for(let tx of (await axios.get('https://www.okx.com/api/v5/market/tickers?instType=SPOT',{httpsAgent:socksAgent})).data.data)
		if(tx.instId.endsWith('USD') || tx.instId.endsWith('USDT')) allTickers.push(tx)
	
	fs.writeFileSync('m',JSON.stringify(allTickers))
	console.log('OKX USD报价',allTickers.length)
}

function getValueByPath(obj, pathArray) {
  return pathArray.reduce((current, key) => {
    return current?.[key];
  }, obj);
}

//分享站点抓取
async function loadShareSite(){
	
	const siteMaps=[//各分享站点地图，框架是一样的
		['https://www.yudou789.top/category/jiedian', //导航url
		 'posts',0,2, //元素选择器,开始索引和加载个数，用于遍历,一般可取首个（最新）；
		 ["children", 1, "children", 0, "children", 0, "attribs", "href"], //子页面href相对路径
		 /https:\/\/hh\.yudou226\.top\/[^\/]+\/[^\/]+\.txt/g	//订阅链接匹配正则
		],
		['https://www.mibei77.com', //导航url
		 'article',0,2, //元素选择器,开始索引和加载个数，用于遍历,一般可取首个（最新）；
		 ["children", 1, "children", 1, "children", 0, "attribs", "href"], //子页面href相对路径
		 /https:\/\/mm\.mibei77\.com\/[^\s]+\.txt/g
		],
		['https://www.freeclashnode.com', //clash-meta.github.io所嫖地址
		 'a[href*="-free-subscribe-node.htm"]',0,1,
		 ["attribs", "href"], //子页面href相对路径
		 /https:\/\/node\.freeclashnode\.com\/\S+?\.txt/g
		],
		['https://nodev2ray.com',
		 'a[href*="-free-high-speed-nodes.htm"]',0,1,
		 ["attribs", "href"], //子页面href相对路径
		 /https:\/\/node\.nodev2ray\.com\/^\S+?\.txt/g
		]
		/*['https://www.naidounode.com', //节点全炸
		 'a.text-reset',0,2,
		 ["attribs", "href"], //子页面href相对路径
		 /https:\/\/node\.freeclashnode\.com\/[^/\s]+\.txt/g
		]*/
	];
	let returls=[]
	for(let s of siteMaps){
		try{
		console.log('解析分享主页导航...',s[0])
		let $=cheerio.load((await axios.get(s[0],{httpsAgent:socksAgent})).data)(s[1])
		for(let li=s[2];li<s[3]&&li<$.length;++li){
			const p = $[li]
			let shref = getValueByPath(p,s[4]).trim()
			if(!shref.startsWith('http')) shref = s[0] + shref //相对路径
			
			console.log('解析子页导航...',shref)
			let $2 = cheerio.load((await axios.get(shref,{httpsAgent:socksAgent})).data)
			//console.log(getValueByPath(p,s[4]))
			const matches = ($2('body').text().match(s[5])) || [];
			for(let u of matches){
				returls.push(u)
				console.log('提出分享链接...',u)
			}
		}

		}catch(e){console.error(s[0],'分享网站加载失败:', e.message)}
	}
	return returls
}

//
async function loadYoutubeSbj(playlistid,rgx,rgx2){
	console.log('解析YT主播最新视频简介...')
	try{
	let ydtxt = (await axios.get('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId='+playlistid+'&maxResults=99&key='+process.env.YTKEY,{httpsAgent:socksAgent})).data.items[0].snippet.description
	const matches = (ydtxt.match(rgx)) || [];
	if(matches[0]){
		let $2 = cheerio.load((await axios.get(matches[0],{httpsAgent:socksAgent})).data)
		
		let matches2=($2('body').text().match(rgx2)) || [];
		console.log('提出订阅链接:',matches2)
		return matches2
	}
	
	}catch(e){console.error('油管API加载失败',e)}
	return []
}

const { execSync } = require('child_process');

async function loadGitCustom(){
	//骚包分享者把资源打包了
	for(let c of (await axios.get('https://api.github.com/repos/zzzhhh1/2024-/commits')).data){
		const f = (await axios.get(c.url)).data.files[0]
		if(!f.filename.endsWith('.7z')) continue

		fs.writeFileSync('temp/t.7z',(await axios.get(f.raw_url, {httpsAgent:socksAgent,responseType: 'arraybuffer' })).data)
		execSync('7z x temp/t.7z -otemp/out -y', { stdio: 'inherit' });
		fs.readdirSync('temp/out').forEach(file => {
		  const filePath = path.join('temp/out', file);
		  const stat = fs.statSync(filePath);

		  if (stat.isFile() && path.extname(file) === '.txt') {
			const content = fs.readFileSync(filePath, 'utf-8'); // 读取文本内容
			if(content.indexOf('ss://')>=0)
				return content.trim()
		  }
		});
		break;
	}
	
	return ""
}
updateData()

// 接下来嫖https://github.com/zzzhhh1/2024-
// https://free.xiaoqikeji.com/
		//v2rayshare.net基本全炸
		//oneclash.cc基本全炸
		//'https://raw.githubusercontent.com/Pawdroid/Free-servers/main/sub', // 1/7 @3.14
		//'https://raw.githubusercontent.com/chengaopan/AutoMergePublicNodes/master/list.txt', // 1/56 @3.14
		//'https://raw.githubusercontent.com/snakem982/proxypool/main/source/v2ray-2.txt', // 6/45 @3.14
		//'https://raw.githubusercontent.com/Barabama/FreeNodes/main/nodes/yudou66.txt', // 需要提取
				//'https://raw.githubusercontent.com/free-nodes/v2rayfree/main/README.md', // 基本全炸，可用性6/168
						//https://raw.githubusercontent.com/adiwzx/freenode/main/adispeed.txt //这个自ID-10086/freenode导流的订阅已全部失效，后续再跟踪
		//crossxx-labs/free-proxy是clash格式订阅，看看有无免费转换方案
