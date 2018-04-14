/**
 *
 * @package phpBB Extension - mChat
 * @copyright (c) 2009 Shapoval Andrey Vladimirovich (AllCity) ~ http://allcity.net.ru/
 * @copyright (c) 2013 Rich McGirr (RMcGirr83) http://rmcgirr83.org
 * @copyright (c) 2015 dmzx - http://www.dmzx-web.net
 * @copyright (c) 2016 kasimi - https://kasimi.net
 * @license http://opensource.org/licenses/gpl-license.php GNU Public License
 *
 */

// Support Opera
if (typeof document.hasFocus === 'undefined') {
	document.hasFocus = function() {
		return document.visibilityState === 'visible';
	};
}

if (!Array.prototype.max) {
	Array.prototype.max = function() {
		return Math.max.apply(null, this);
	};
}

if (!Array.prototype.min) {
	Array.prototype.min = function() {
		return Math.min.apply(null, this);
	};
}

Array.prototype.removeValue = function(value) {
	var index;
	var elementsRemoved = 0;
	while ((index = this.indexOf(value)) !== -1) {
		this.splice(index, 1);
		elementsRemoved++;
	}
	return elementsRemoved;
};

String.prototype.format = function() {
	var str = this.toString();
	if (!arguments.length) {
		return str;
	}
	var type = typeof arguments[0];
	var args = 'string' === type || 'number' === type ? arguments : arguments[0];
	for (var arg in args) {
		if (args.hasOwnProperty(arg)) {
			str = str.replace(new RegExp("\\{" + arg + "\\}", "gi"), args[arg]);
		}
	}
	return str;
};

String.prototype.replaceMany = function() {
	var result = this;
	var args = arguments[0];
	for (var arg in args) {
		if (args.hasOwnProperty(arg)) {
			result = result.replace(new RegExp(RegExp.escape(arg), "g"), args[arg]);
		}
	}
	return result;
};

RegExp.escape = function(s) {
	return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
};

jQuery.fn.reverse = function(reverse) {
	return typeof reverse === 'undefined' || reverse ? jQuery(this.toArray().reverse()) : this;
};

function StorageWrapper(storage, prefix) {
	this.prefix = prefix;
	try {
		this.storage = window[storage];
		this.storage.setItem(prefix, prefix);
		this.storage.removeItem(prefix);
	} catch (e) {
		this.storage = false;
	}
}

StorageWrapper.prototype.get = function(key) {
	return this.storage && this.storage.getItem(this.prefix + key);
};

StorageWrapper.prototype.set = function(key, value) {
	this.storage && this.storage.setItem(this.prefix + key, value);
};

StorageWrapper.prototype.remove = function(key) {
	return this.storage && this.storage.removeItem(this.prefix + key);
};

jQuery(function($) {

	"use strict";

	$.extend(mChat, {
		storage: new StorageWrapper('localStorage', mChat.cookie + 'mchat_'),
		ajaxRequest: function(mode, sendHiddenFields, data) {
			if (mChat.pageIsUnloading) {
				return;
			}
			var deferred = $.Deferred();
			if (sendHiddenFields) {
				$.extend(data, mChat.hiddenFields);
			}
			$(mChat).trigger('mchat_send_request_before', [mode, data]);
			$.ajax({
				url: mChat.actionUrls[mode],
				timeout: Math.min(mChat.refreshTime, 10000),
				type: 'POST',
				dataType: 'json',
				data: data,
				context: {
					mode: mode,
					deferred: deferred
				}
			}).done(mChat.ajaxDone).fail(deferred.reject);
			return deferred.promise().fail(mChat.ajaxFail);
		},
		ajaxDone: function(json, status, xhr) {
			var data = {
				mode: this.mode,
				json: json,
				status: status,
				xhr: xhr,
				handle: true
			};
			$(mChat).trigger('mchat_ajax_done_before', [data]);
			if (data.handle) {
				if (json[this.mode]) {
					this.deferred.resolve(data.json, data.status, data.xhr);
				} else {
					this.deferred.reject(data.xhr, data.status, mChat.lang.parserErr);
				}
			}
		},
		ajaxFail: function(xhr, textStatus, errorThrown) {
			if (mChat.pageIsUnloading) {
				return;
			}
			if (typeof console !== 'undefined' && console.log) {
				console.log('AJAX error. status: ' + textStatus + ', message: ' + errorThrown + ' (' + xhr.responseText + ')');
			}
			var data = {
				mode: this.mode,
				xhr: xhr,
				textStatus: textStatus,
				errorThrown: errorThrown,
				updateSession: function() {
					if (this.xhr.status === 403) {
						mChat.endSession(true);
					} else if (this.xhr.status === 400) {
						mChat.resetSession();
					}
				}
			};
			$(mChat).trigger('mchat_ajax_fail_before', [data]);
			mChat.sound('error');
			mChat.status('error');
			var title = mChat.lang.err;
			var responseText;
			try {
				var json = data.xhr.responseJSON;
				if (json.S_USER_WARNING || json.S_USER_NOTICE) {
					title = json.MESSAGE_TITLE;
					responseText = json.MESSAGE_TEXT;
					data.xhr.status = 403;
				} else {
					responseText = json.message || data.errorThrown;
				}
			} catch (e) {
				responseText = data.errorThrown;
			}
			if (responseText && responseText !== 'timeout') {
				phpbb.alert(title, responseText);
			}
			data.updateSession();
		},
		toggleEnter: function(e) {
			e.stopPropagation();
			if (mChat.cached('enter').toggleClass('mchat-enter-submit mchat-enter-linebreak').hasClass('mchat-enter-submit')) {
				mChat.storage.remove('no_enter');
			} else {
				mChat.storage.set('no_enter', 'yes');
			}
		},
		toggleSound: function(e) {
			e.stopPropagation();
			if (mChat.cached('sound').toggleClass('mchat-sound-on mchat-sound-off').hasClass('mchat-sound-on')) {
				mChat.storage.remove('no_sound');
			} else {
				mChat.storage.set('no_sound', 'yes');
			}
		},
		sound: function(file) {
			var data = {
				audio: mChat.cached('sound-' + file).get(0),
				file: file,
				play: !mChat.pageIsUnloading && mChat.cached('sound').hasClass('mchat-sound-on')
			};
			$(mChat).trigger('mchat_sound_before', [data]);
			if (data.play && data.audio && data.audio.duration) {
				data.audio.pause();
				data.audio.currentTime = 0;
				data.audio.play();
			}
		},
		titleAlert: function() {
			var data = {
				doAlert: !document.hasFocus(),
				interval: 1000
			};
			$(mChat).trigger('mchat_titlealert_before', [data]);
			if (data.doAlert) {
				$.titleAlert(mChat.lang.newMessageAlert, data);
			}
		},
		toggle: function(name) {
			var $elem = mChat.cached(name);
			$elem.stop().slideToggle(200, function() {
				if ($elem.is(':visible')) {
					mChat.storage.set('show_' + name, 'yes');
				} else {
					mChat.storage.remove('show_' + name);
				}
			});
		},
		confirm: function(data) {
			var $confirmFields = data.container.find('.mchat-confirm-fields');
			$confirmFields.children().hide();
			var fields = data.fields($confirmFields);
			$.each(fields, function() {
				$(this).show();
			});
			setTimeout(function() {
				var $input = $confirmFields.find(':input:visible:enabled:first');
				if ($input.length) {
					var value = $input.val();
					$input.focus().val('').val(value);
				}
			}, 1);
			phpbb.confirm(data.container.show(), function(success) {
				if (success && typeof data.confirm === 'function') {
					data.confirm.apply(this, fields);
				}
			});
		},
		add: function() {
			var $add = mChat.cached('add');
			if ($add.prop('disabled')) {
				return;
			}
			var $input = mChat.cached('input');
			var originalInputValue = mChat.cleanMessage($input.val()).trim();
			var messageLength = originalInputValue.length;
			if (!messageLength) {
				phpbb.alert(mChat.lang.err, mChat.lang.noMessageInput);
				return;
			}
			if (mChat.mssgLngth && messageLength > mChat.mssgLngth) {
				phpbb.alert(mChat.lang.err, mChat.lang.mssgLngthLong);
				return;
			}
			$add.prop('disabled', true);
			mChat.pauseSession();
			var inputValue = originalInputValue;
			var color = mChat.storage.get('color');
			if (color && inputValue.indexOf('[color=') === -1) {
				inputValue = '[color=#' + color + '] ' + inputValue + ' [/color]';
			}
			mChat.setText('');
			mChat.refresh(inputValue).done(function() {
				mChat.resetSession();
			}).fail(function() {
				mChat.setText(originalInputValue);
			}).always(function() {
				$add.prop('disabled', false);
				$input.delay(1).focus();
			});
		},
		edit: function() {
			var $message = $(this).closest('.mchat-message');
			mChat.confirm({
				container: mChat.cached('confirm'),
				fields: function($container) {
					return [
						$container.find('p').text(mChat.lang.editInfo),
						$container.find('textarea').val($message.data('mchat-message'))
					];
				},
				confirm: function($p, $textarea) {
					mChat.ajaxRequest('edit', true, {
						message_id: $message.data('mchat-id'),
						message: $textarea.val(),
						page: mChat.page
					}).done(function(json) {
						mChat.updateMessages($(json.edit));
						mChat.resetSession();
					});
				}
			});
		},
		del: function() {
			var delId = $(this).closest('.mchat-message').data('mchat-id');
			mChat.confirm({
				container: mChat.cached('confirm'),
				fields: function($container) {
					return [
						$container.find('p').text(mChat.lang.delConfirm)
					];
				},
				confirm: function() {
					mChat.ajaxRequest('del', true, {
						message_id: delId
					}).done(function() {
						mChat.removeMessages([delId]);
						mChat.resetSession();
					});
				}
			});
		},
		refresh: function(message) {
			var data = {
				last: mChat.messageIds.length ? mChat.messageIds.max() : 0
			};
			if (message) {
				data.message = message;
			}
			if (mChat.liveUpdates) {
				data.log = mChat.logId;
			}
			mChat.status('loading');
			return mChat.ajaxRequest(message ? 'add' : 'refresh', !!message, data).done(function(json) {
				$(mChat).trigger('mchat_response_handle_data_before', [json]);
				if (json.add) {
					mChat.addMessages($(json.add));
				}
				if (json.edit) {
					mChat.updateMessages($(json.edit));
				}
				if (json.del) {
					mChat.removeMessages(json.del);
				}
				if (json.whois) {
					mChat.handleWhoisResponse(json);
				}
				if (json.log) {
					mChat.logId = json.log;
				}
				if (mChat.refreshInterval) {
					mChat.status('ok');
				}
				$(mChat).trigger('mchat_response_handle_data_after', [json]);
			});
		},
		rules: function() {
			$('.mchat-nav-link-title').each(phpbb.toggleDropdown);
			popup(this.href, 450, 275);
		},
		whois: function() {
			if (mChat.page === 'custom') {
				mChat.cached('refresh-pending').show();
				mChat.cached('refresh-explain').hide();
			}
			mChat.ajaxRequest('whois', false, {}).done(mChat.handleWhoisResponse);
		},
		smiley: function() {
			mChat.appendText($(this).data('smiley-code'), true);
		},
		smileyPopup: function() {
			popup(this.href, 300, 350, '_phpbbsmilies');
		},
		handleWhoisResponse: function(json) {
			var $whois = $(json.container);
			var $userlist = $whois.find('#mchat-userlist');
			if (mChat.storage.get('show_userlist')) {
				$userlist.show();
			}
			mChat.cached('whois').replaceWith($whois);
			mChat.cache.whois = $whois;
			mChat.cache.userlist = $userlist;
			if (mChat.page === 'custom') {
				mChat.cached('refresh-pending').hide();
				mChat.cached('refresh-explain').show();
			}
			if (json.navlink) {
				$('.mchat-nav-link').html(json.navlink);
			}
			if (json.navlink_title) {
				$('.mchat-nav-link-title').prop('title', json.navlink_title);
			}
		},
		addMessages: function($messages) {
			var playSound = true;
			mChat.cached('messages').find('.mchat-no-messages').remove();
			$messages.reverse(mChat.messageTop).hide().each(function(i) {
				var $message = $(this);
				var dataAddMessageBefore = {
					message: $message,
					delay: mChat.refreshInterval ? 400 : 0,
					abort: $.inArray($message.data('mchat-id'), mChat.messageIds) !== -1,
					playSound: playSound
				};
				$(mChat).trigger('mchat_add_message_before', [dataAddMessageBefore]);
				if (dataAddMessageBefore.abort) {
					return;
				}
				if (dataAddMessageBefore.playSound) {
					mChat.sound('add');
					mChat.titleAlert();
					playSound = false;
				}
				mChat.messageIds.push($message.data('mchat-id'));
				setTimeout(function() {
					var dataAddMessageAnimateBefore = {
						container: mChat.cached('messages'),
						message: $message,
						add: function() {
							if (mChat.messageTop) {
								this.container.prepend(this.message);
							} else {
								this.container.append(this.message);
							}
						},
						show: function() {
							var container = this.container;
							var scrollTop = container.scrollTop();
							var scrollLeeway = 20;
							if (mChat.messageTop && scrollTop <= scrollLeeway || !mChat.messageTop && scrollTop >= container.get(0).scrollHeight - container.height() - scrollLeeway) {
								var animateOptions = {
									duration: dataAddMessageBefore.delay - 10,
									easing: 'swing'
								};
								this.message.slideDown(animateOptions);
								if (mChat.messageTop) {
									container.animate({scrollTop: 0}, animateOptions);
								} else {
									(animateOptions.complete = function() {
										var scrollHeight = container.get(0).scrollHeight;
										if (container.scrollTop() + container.height() < scrollHeight) {
											container.animate({scrollTop: scrollHeight}, animateOptions);
										}
									})();
								}
							} else {
								this.message.show();
								if (mChat.messageTop) {
									this.container.scrollTop(scrollTop + this.message.outerHeight());
								}
							}
							this.message.addClass('mchat-message-flash');
						}
					};
					$(mChat).trigger('mchat_add_message_animate_before', [dataAddMessageAnimateBefore]);
					dataAddMessageAnimateBefore.add();
					dataAddMessageAnimateBefore.show();
				}, i * dataAddMessageBefore.delay);
				if (mChat.editDeleteLimit && $message.data('mchat-edit-delete-limit') && $message.find('[data-mchat-action="edit"], [data-mchat-action="del"]').length > 0) {
					var id = $message.prop('id');
					setTimeout(function() {
						$('#' + id).find('[data-mchat-action="edit"], [data-mchat-action="del"]').fadeOut(function() {
							$(this).closest('li').remove();
						});
					}, mChat.editDeleteLimit);
				}
				mChat.startRelativeTimeUpdate($message);
			});
		},
		updateMessages: function($messages) {
			var playSound = true;
			$messages.each(function() {
				var $newMessage = $(this);
				var data = {
					newMessage: $newMessage,
					oldMessage: $('#mchat-message-' + $newMessage.data('mchat-id')),
					playSound: playSound
				};
				$(mChat).trigger('mchat_edit_message_before', [data]);
				mChat.stopRelativeTimeUpdate(data.oldMessage);
				mChat.startRelativeTimeUpdate(data.newMessage);
				data.oldMessage.fadeOut(function() {
					data.oldMessage.replaceWith(data.newMessage.hide().fadeIn());
				});
				if (data.playSound) {
					mChat.sound('edit');
					playSound = false;
				}
			});
		},
		removeMessages: function(ids) {
			var playSound = true;
			$.each(ids, function(i, id) {
				if (mChat.messageIds.removeValue(id)) {
					var data = {
						id: id,
						message: $('#mchat-message-' + id),
						playSound: playSound
					};
					$(mChat).trigger('mchat_delete_message_before', [data]);
					mChat.stopRelativeTimeUpdate(data.message);
					(function($message) {
						$message.fadeOut(function() {
							$message.remove();
						});
					})(data.message);
					if (data.playSound) {
						mChat.sound('del');
						playSound = false;
					}
				}
			});
		},
		startRelativeTimeUpdate: function($messages) {
			if (mChat.relativeTime) {
				$messages.find('.mchat-time[data-mchat-relative-update]').each(function() {
					var $time = $(this);
					setTimeout(function() {
						mChat.relativeTimeUpdate($time);
						$time.data('mchat-relative-interval', setInterval(function() {
							mChat.relativeTimeUpdate($time);
						}, 60 * 1000));
					}, $time.data('mchat-relative-update') * 1000);
				});
			}
		},
		relativeTimeUpdate: function($time) {
			var minutesAgo = $time.data('mchat-minutes-ago') + 1;
			var langMinutesAgo = mChat.lang.minutesAgo[minutesAgo];
			if (langMinutesAgo) {
				$time.text(langMinutesAgo).data('mchat-minutes-ago', minutesAgo);
			} else {
				mChat.stopRelativeTimeUpdate($time);
				$time.text($time.attr('title')).removeAttr('data-mchat-relative-update data-mchat-minutes-ago data-mchat-relative-interval');
			}
		},
		stopRelativeTimeUpdate: function($message) {
			var selector = '.mchat-time[data-mchat-relative-update]';
			clearInterval($message.find(selector).addBack(selector).data('mchat-relative-interval'));
		},
		countDown: function() {
			mChat.sessionTime -= 1;
			if (mChat.sessionTime < 1) {
				mChat.endSession();
			}
		},
		status: function(status) {
			var data = {
				status: status,
				all: ['ok', 'loading', 'idle', 'error'],
				container: mChat.cached('body')
			};
			$(mChat).trigger('mchat_status_before', [data]);
			var i = data.all.indexOf(data.status);
			if (i > -1) {
				data.all.splice(i, 1);
				data.container.addClass('mchat-status-' + data.status);
				for (var j = 0; j < data.all.length; j++) {
					data.container.removeClass('mchat-status-' + data.all[j]);
				}
			}
		},
		pauseSession: function() {
			clearInterval(mChat.refreshInterval);
			if (mChat.timeout) {
				clearInterval(mChat.sessionCountdown);
			}
			if (mChat.whoisRefresh) {
				clearInterval(mChat.whoisInterval);
			}
		},
		resetSession: function() {
			if (mChat.page !== 'archive') {
				clearInterval(mChat.refreshInterval);
				mChat.refreshInterval = setInterval(mChat.refresh, mChat.refreshTime);
				if (mChat.timeout) {
					mChat.sessionTime = mChat.timeout / 1000;
					clearInterval(mChat.sessionCountdown);
					mChat.sessionCountdown = setInterval(mChat.countDown, 1000);
				}
				if (mChat.whoisRefresh) {
					clearInterval(mChat.whoisInterval);
					mChat.whoisInterval = setInterval(mChat.whois, mChat.whoisRefresh);
				}
				mChat.status('ok');
			}
		},
		endSession: function(skipUpdateWhois) {
			clearInterval(mChat.refreshInterval);
			mChat.refreshInterval = false;
			if (mChat.timeout) {
				clearInterval(mChat.sessionCountdown);
			}
			if (mChat.whoisRefresh) {
				clearInterval(mChat.whoisInterval);
				if (!skipUpdateWhois) {
					mChat.whois();
				}
			}
			mChat.status('idle');
		},
		updateCharCount: function() {
			var count = mChat.cleanMessage(mChat.cached('input').val()).length;
			var exceedCount = Math.max(mChat.mssgLngth - count, -999);
			if (mChat.showCharCount) {
				var charCount = mChat.lang.charCount.format({current: count, max: mChat.mssgLngth});
				var $elem = mChat.cached('character-count').html(charCount).toggleClass('invisible', count === 0);
				if (mChat.mssgLngth) {
					$elem.toggleClass('error', count > mChat.mssgLngth);
				}
			}
			mChat.cached('exceed-character-count').text(exceedCount).toggleClass('hidden', exceedCount >= 0);
			mChat.cached('input').parent().toggleClass('mchat-input-error', exceedCount < 0);
			mChat.cached('add').toggleClass('hidden', exceedCount < 0);
		},
		cleanMessage: function(message) {
			if (!mChat.maxInputHeight) {
				message = message.replace(/\s+/g, ' ');
			}
			return message;
		},
		mention: function() {
			var $container = $(this).closest('.mchat-message');
			var username = $container.data('mchat-username');
			if (mChat.allowBBCodes) {
				var profileUrl = $container.find(".mchat-message-header a[class^='username']").prop('href');
				if (profileUrl) {
					var usercolor = $container.data('mchat-usercolor');
					if (usercolor) {
						username = '[url=' + profileUrl + '][b][color=' + usercolor + ']' + username + '[/color][/b][/url]';
					} else {
						username = '[url=' + profileUrl + '][b]' + username + '[/b][/url]';
					}
				}
			}
			mChat.appendText(mChat.lang.mention.format({username: username}));
		},
		quote: function() {
			var $container = $(this).closest('.mchat-message');
			var username = $container.data('mchat-username');
			var quote = $container.data('mchat-message');
			mChat.appendText('[quote="' + username + '"] ' + quote + '[/quote]');
		},
		like: function() {
			var $container = $(this).closest('.mchat-message');
			var username = $container.data('mchat-username');
			var quote = $container.data('mchat-message');
			mChat.appendText('[i]' + mChat.lang.likes + '[/i][quote="' + username + '"] ' + quote + '[/quote]');
		},
		ip: function() {
			popup(this.href, 750, 500);
		},
		custom: function() {
			window.location.href = this.href;
		},
		archive: function() {
			window.location.href = this.href;
		},
		setText: function(text) {
			mChat.cached('input').val('');
			mChat.appendText(text)
		},
		appendText: function(text, spaces, popup) {
			var $input = mChat.cached('input');
			if (text) {
				insert_text(text, spaces, popup);
			}
			if (mChat.maxInputHeight) {
				autosize.update($input);
			} else {
				$input.scrollLeft($input[0].scrollWidth - $input[0].clientWidth);
			}
		},
		cached: function(name) {
			if (!mChat.cache) {
				mChat.cache = {};
			}
			if (!mChat.cache[name]) {
				mChat.cache[name] = $('#mchat-' + name);
			}
			return mChat.cache[name];
		}
	});

	mChat.messageIds = mChat.cached('messages').children().map(function() {
		return $(this).data('mchat-id');
	}).get();

	mChat.hiddenFields = {};
	mChat.cached('form').find('input[type=hidden]').each(function() {
		mChat.hiddenFields[this.name] = this.value;
	});

	if (mChat.page !== 'archive') {
		mChat.resetSession();

		if (!mChat.messageTop) {
			mChat.cached('messages').delay(1).scrollTop(mChat.cached('messages')[0].scrollHeight);
		}

		var playSound = mChat.playSound && !mChat.storage.get('no_sound');
		mChat.cached('sound').toggleClass('mchat-sound-on', playSound).toggleClass('mchat-sound-off', !playSound);

		var enterSubmits = mChat.maxInputHeight && !mChat.storage.get('no_enter');
		mChat.cached('enter').toggleClass('mchat-enter-submit', enterSubmits).toggleClass('mchat-enter-linebreak', !enterSubmits);

		$.each(mChat.removeBBCodes.split('|'), function(i, bbcode) {
			var bbCodeClass = '.bbcode-' + bbcode.replaceMany({
				'=': '-',
				'*': 'asterisk'
			});
			mChat.cached('body').find(bbCodeClass).remove();
		});

		var $colourPalette = $('#mchat-bbcodes').find('#colour_palette');
		$colourPalette.appendTo($colourPalette.parent()).wrap('<div id="mchat-colour"></div>').show();
		$('#bbpalette,#abbc3_bbpalette,#color_wheel').prop('onclick', null).attr('data-mchat-toggle', 'colour');

		$.each(['userlist', 'smilies', 'bbcodes', 'colour'], function(i, elem) {
			if (mChat.storage.get('show_' + elem)) {
				$('.mchat-button-' + elem).addClass('mchat-button-is-down');
				mChat.cached(elem).toggle();
			}
		});

		if (mChat.maxInputHeight) {
			mChat.cached('input').one('focus', function() {
				autosize(this);
			});
		}

		mChat.cached('form').submit(function(e) {
			e.preventDefault();
		}).keypress(function(e) {
			if (e.which === 10 || e.which === 13) {
				if (mChat.cached('input').is(e.target)) {
					var isCtrl = e.ctrlKey || e.metaKey;
					if (!mChat.maxInputHeight || !isCtrl === !mChat.storage.get('no_enter')) {
						e.preventDefault();
						mChat.add();
					} else if (mChat.maxInputHeight && isCtrl) {
						mChat.appendText('\n');
					}
				}
			}
		});

		if (mChat.showCharCount || mChat.mssgLngth) {
			mChat.cached('form').on('input', mChat.updateCharCount);
			mChat.cached('input').on('focus', function() {
				setTimeout(mChat.updateCharCount, 1);
			});
		}
	}

	mChat.startRelativeTimeUpdate(mChat.cached('messages'));

	$(window).on('beforeunload', function() {
		mChat.pageIsUnloading = true;
	});

	mChat.cached('colour').find('.colour-palette').on('click', 'a', function(e) {
		if (e.ctrlKey || e.metaKey) {
			e.preventDefault();
			e.stopImmediatePropagation();
			var $this = $(this);
			var newColor = $this.data('color');
			if (mChat.storage.get('color') === newColor) {
				mChat.storage.remove('color');
			} else {
				mChat.storage.set('color', newColor);
				mChat.cached('colour').find('.colour-palette a').removeClass('remember-color');
			}
			$this.toggleClass('remember-color');
		}
	});

	var color = mChat.storage.get('color');
	if (color) {
		mChat.cached('colour').find('.colour-palette a[data-color="' + color + '"]').addClass('remember-color');
	}

	$('#phpbb').on('click', '[data-mchat-action]', function(e) {
		e.preventDefault();
		var action = $(this).data('mchat-action');
		mChat[action].call(this, e);
	}).on('click', '[data-mchat-toggle]', function() {
		var elem = $(this).data('mchat-toggle');
		mChat.toggle(elem);
	}).on('click', '.mchat-panel-buttons button', function() {
		var $this = $(this).blur();
		if ($this.hasClass('mchat-button-down')) {
			$this.toggleClass('mchat-button-is-down');
		}
	});
});
