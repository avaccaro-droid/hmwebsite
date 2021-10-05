(function($){
	$.fn.baambooBreadCrumb = function(options) {
		var opts = jQuery.extend({
			target: this,
			root: '.menu',
			homeURL: "//"+document.domain,
			homeTitle: 'Home',
			separate: '&gt;',
			showOnHome: false,
			showLast: true
			
		}, options || {});
	
		var $selector	= $(this);
		var root		= this.root || opts.root;	
		var homeURL		= this.homeURL || opts.homeURL;	
		var homeTitle	= this.homeTitle || opts.homeTitle;
		var separate	= this.separate || opts.separate;
		var showOnHome	= this.showOnHome || opts.showOnHome;
		var showLast	= this.showLast || opts.showLast;
		var home		= 0;
		var $txt		= '';
		var breadCrumb	= new Array();
		//Check if current page is homepage
		var pathname = window.location.pathname;
		if(pathname.toLowerCase()=='/'.toLowerCase() || pathname.toLowerCase()=='/index.html'.toLowerCase()){
			home = 1;
		}
		if($(root).find(".wsite-menu-default li#active").length>0){
			if(!home){
				breadCrumb.push($(root).find('#active'));
			}
		}else if($(root).find('.wsite-nav-current').length>0){
			breadCrumb.push($(root).find('.wsite-nav-current'));
		}else{
			var tmpTitle = $("meta[property='og:title']").attr('content');
			breadCrumb.push(tmpTitle);
		}
		$(root).find('.wsite-nav-current').parents('li').each(function() {
			breadCrumb.push($(this));
		});
		console.log(breadCrumb);
		if(showOnHome || !home){
			$txt			+= '<div class="breadItem" itemscope="" itemtype="http://data-vocabulary.org/Breadcrumb">';
			$txt			+= '	<a href="'+homeURL+'" itemprop="url">';
			$txt			+= '		<span itemprop="title">'+homeTitle+'</span>';
			$txt			+= '	</a>';
			$txt			+= '</div>';
		}
		for(i = breadCrumb.length-1;i>0;i--){
			var breadURL	= breadCrumb[i].children('a').attr('href');
			var breadTitle	= breadCrumb[i].children('a').children('.wsite-menu-title').text()?breadCrumb[i].children('a').children('.wsite-menu-title').text():breadCrumb[i].children('a').text();
			$txt			+= '<div class="breadItem" itemscope="" itemtype="http://data-vocabulary.org/Breadcrumb">';
			if(separate.indexOf('http://')>-1){
				$txt		+= '	<img class="breadSep" src="'+separate+'" alt="" />';
			}else{
				$txt		+= '	<span class="breadSep">'+separate+'</span>';
			}
			$txt			+= '	<a href="'+breadURL+'" itemprop="url">';
			$txt			+= '		<span itemprop="title">'+breadTitle+'</span>';
			$txt			+= '	</a>';
			$txt			+= '</div>';
		}
		if(showLast){
			if($.type(breadCrumb[0])=='object'){
				var breadURL	= breadCrumb[i].children('a').attr('href');
				var breadTitle	= breadCrumb[i].children('a').children('.wsite-menu-title').text()?breadCrumb[i].children('a').children('.wsite-menu-title').text():breadCrumb[i].children('a').text();
				$txt			+= '<div class="breadItem" itemscope="" itemtype="http://data-vocabulary.org/Breadcrumb">';
				if(separate.indexOf('http://')>-1){
					$txt		+= '	<img class="breadSep" src="'+separate+'" alt="" />';
				}else{
					$txt		+= '	<span class="breadSep">'+separate+'</span>';
				}
				$txt			+= '	<a href="'+breadURL+'" itemprop="url">';
				$txt			+= '		<span itemprop="title">'+breadTitle+'</span>';
				$txt			+= '	</a>';
				$txt			+= '</div>';
			}else{
				var breadURL	= document.URL;
				var breadTitle	= breadCrumb[0];
				$txt			+= '<div class="breadItem" itemscope="" itemtype="http://data-vocabulary.org/Breadcrumb">';
				if(separate.indexOf('http://')>-1){
					$txt		+= '	<img class="breadSep" src="'+separate+'" alt="" />';
				}else{
					$txt		+= '	<span class="breadSep">'+separate+'</span>';
				}
				$txt			+= '	<a href="'+breadURL+'" itemprop="url">';
				$txt			+= '		<span itemprop="title">'+breadTitle+'</span>';
				$txt			+= '	</a>';
				$txt			+= '</div>';
			}
		}
		$selector.append($txt);
	}
})(jQuery);