/*v2ray式URL(vless://xxx, ss://xxx, ...)转换工具
功能和用法
let v = new V2Uri('vless://xxxxx')
console.log('用于去重的节点指纹',v.FP)
console.log(v.toCoreOutbound('xray'))//输出内核配置，目前支持xray,singbox
*/
const hashBy = ['protocol','hostname','port','username','sni','flow','pbk','type','sid','path','host','fp','net','serviceName','security','alpn']//指纹依据属性

function safeJson(s){return JSON.parse(s)}//暂代
function fromBase64(bstr){return Buffer.from(bstr.trim(), 'base64').toString('utf-8')} //暂代
function url2std(urlstr){//转为中间格式
	let u = new URL(urlstr.replaceAll('&amp;','&'))

	let ob = {protocol:u.protocol.slice(0,-1)}
	
	//vmess是json的base64编码，特殊情况单独处理
	if(ob.protocol == 'vmess'){
		let vj = safeJson(atob(urlstr.slice(8)))
		
		Object.assign(ob, {
			hostname:vj.add,
			port:vj.port,
			username:vj.id,
			scy:vj.scy||'auto',
			aid:vj.aid ? parseInt(vj.aid):0,
			hash:vj.ps,
			net:vj.net,
			path:vj.path,
			host:vj.host
		})
	}else{//其他普通格式协议
		[ob.hostname,ob.port,ob.hash,ob.username] = [u.hostname,u.port,decodeURI(u.hash.slice(1)),u.username];
		for (let [k, v] of u.searchParams)
			if(v&&v.length>0) ob[k] = v

	}
	
	//修正数据格式、默认值等
	ob.port = parseInt(ob.port)
	try{ob.alpn = ob.alpn.split(',')}catch{}
	if(ob.protocol == 'ss'){
		ob.protocol = 'shadowsocks';
		[ob.method,ob.password] = fromBase64(u.username).split(':');
		//if(ob.method == 'chacha20-poly1305') ob.method = "chacha20-ietf-poly1305" //不支持？
	}

	return ob
}

function djb2Hash(str) {
  let hash = 5381;
  
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  
  hash = hash >>> 0; // 确保为正数
  
  // 转换为8位十六进制，不足补零
  return hash.toString(16).padStart(8, '0');
}


function buildFromMap(map, ob){
  if (typeof map === 'string') {
    return ob[map]
  }

  if (typeof map === 'function') {
    return map.call(ob)
  }

  if (Array.isArray(map)) {
    return map
      .map(item => buildFromMap(item, ob))
      .filter(v => v !== undefined)
  }

  if (typeof map === 'object' && map !== null) {
    const out = {}
    for (const [k, v] of Object.entries(map)) {
      const val = buildFromMap(v, ob)
      if (val !== undefined) out[k] = val
    }
    return out
  }

  return map
}

function pruneUndefined(obj) {
  if (Array.isArray(obj)) {
    return obj
      .map(pruneUndefined)
      .filter(v => v !== undefined)
  }

  if (obj && typeof obj === 'object') {
    for (let k of Object.keys(obj)) {
      let v = pruneUndefined(obj[k])
      if (v === undefined) {
        delete obj[k]
      } else {
        obj[k] = v
      }
    }
    return Object.keys(obj).length ? obj : undefined
  }

  if (obj === undefined) return undefined
  return obj
}

const coreMaps = {
  xray: {
    vless: {
      protocol: 'protocol',
      tag: 'hash',

      settings: {
        vnext: [{
          address: 'hostname',
          port: 'port',
          users: [{
            id: 'username',
            flow: 'flow',
            encryption: function(){
              return this.encryption || 'none'
            }
          }]
        }]
      },

      streamSettings: {
        security: function(){
          return this.pbk ? 'reality' : this.security
        },

        tlsSettings: function(){
          if (this.security !== 'tls') return
          return {
            allowInsecure: this.allowInsecure === '1',
            serverName: this.sni,
            alpn: this.alpn
          }
        },

        realitySettings: function(){
          if (!this.pbk) return
          return {
            publicKey: this.pbk,
            shortId: this.sid,
            serverName: this.sni
          }
        }
      }
    },
	trojan: {
      protocol: 'protocol',
      tag: 'hash',

      settings: {
        servers: [{
          address: 'hostname',
          port: 'port',
          password: 'username'
        }]
      },

      streamSettings: {
        security: function(){
          return this.security || 'tls'
        },

        tlsSettings: function(){
          if (this.security !== 'tls') return
          return {
            allowInsecure: this.allowInsecure === '1',
            serverName: this.sni,
            alpn: this.alpn
          }
        }
      }
    },
	shadowsocks: {
      protocol: function(){ return 'shadowsocks' },
      tag: 'hash',

      settings: {
        servers: [{
          address: 'hostname',
          port: 'port',
          method: 'method',
          password: 'password'
        }]
      }
    }
  },

  singbox: {
    vless: {
      type: 'protocol',
      tag: 'hash',
      server: 'hostname',
      server_port: 'port',
      uuid: 'username',
      flow: 'flow',

      tls: function(){
        if (this.security !== 'tls' && this.security !== 'reality') return
        return {
          enabled: true,
          server_name: this.sni,
          insecure: this.allowInsecure === '1',
          utls: this.fp ? { fingerprint: this.fp } : undefined,
          alpn: this.alpn
        }
      },

      transport: function(){
        if (!this.type || this.type === 'tcp') return
        return {
          type: this.type,
          path: this.path,
          headers: this.host ? { Host: this.host } : undefined,
          service_name: this.serviceName
        }
      },

      tls_reality: function(){
        if (!this.pbk) return
        return {
          enabled: true,
          public_key: this.pbk,
          short_id: this.sid
        }
      }
    },
	trojan: {
      type: 'protocol',
      tag: 'hash',
      server: 'hostname',
      server_port: 'port',
      password: 'password',

      tls: function(){
        if (this.security !== 'tls') return
        return {
          enabled: true,
          server_name: this.sni,
          insecure: this.allowInsecure === '1',
          alpn: this.alpn
        }
      },

      transport: function(){
        if (!this.type || this.type === 'tcp') return
        return {
          type: this.type,
          path: this.path,
          headers: this.host ? { Host: this.host } : undefined,
          service_name: this.serviceName
        }
      }
    },
	shadowsocks: {
      type: function(){ return 'shadowsocks' },
      tag: 'hash',
      server: 'hostname',
      server_port: 'port',
      method: 'method',
      password: 'password'
    },

    hysteria2: {
      type: function(){ return 'hysteria2' },
      tag: 'hash',
      server: 'hostname',
      server_port: 'port',
      password: 'password',

      tls: function(){
        return {
          enabled: true,
          server_name: this.sni,
          insecure: this.allowInsecure === '1',
          alpn: this.alpn
        }
      },

      obfs: function(){
        if (!this.obfs) return
        return {
          type: this.obfs,
          password: this['obfs-password']
        }
      }
    }
  }
}

//复制类似模板和参数微调
coreMaps.xray.vmess=coreMaps.xray.vless
coreMaps.singbox.vmess=coreMaps.singbox.vless

//mixed入口映射
const mixedInboundMap={
	xray:{
		protocol:'protocol',
		port:'port',
		listen:'listen'
	},
	singbox:{
		protocol:'type',
		port:'listen_port',
		listen:'listen'
	}
}


class V2Uri {
	static getMixedInbound(port,coreName='singbox',listen='127.0.0.1',protocol='mixed'){
		let t = mixedInboundMap[coreName]
		if(!t) throw new Error(`No template for ${coreName}`)

		let ib = {}
		ib[t.protocol]=protocol
		ib[t.port]=port
		ib[t.listen]=listen

		return ib
	}
	constructor(urlstr){
		this.originUri = urlstr
		this.stdOutBound = url2std(urlstr)
		this.updateFP()
	}
	//get Uri(){}//后续实现
	//UpdateUri's fingerprint if key params changed
	updateFP(){
		let str=""
		for(let p of hashBy) if(this.stdOutBound[p]) str+=JSON.stringify(this.stdOutBound[p])
		
		this.FP = djb2Hash(str)
	}

	toCoreOutbound(coreName='singbox'){
		const tpl = coreMaps[coreName]?.[this.stdOutBound.protocol]
		if (!tpl) throw new Error(this.originUri,`No template for ${coreName}:${this.stdOutBound.protocol}`)
      
		return pruneUndefined(buildFromMap(tpl, this.stdOutBound))
	}

}

module.exports = V2Uri