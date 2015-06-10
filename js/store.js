var internetExplorer9andLess = function() {
  return $.browser.msie && (parseFloat($.browser.version) < 10 || parseFloat(document.documentMode) < 10);
};

var detectingIE = function() {
  var ua = window.navigator.userAgent;
  var msie = ua.indexOf("MSIE ");

  if (msie > 0 || !!navigator.userAgent.match(/Trident.*rv\:11\./)) // Internet Explorer
    return true;
  else // another browser
    return false;
};

if ( internetExplorer9andLess() ) {
  document.writeln('<scr' + 'ipt type="text/javascript" src="js/jquery.xdomainrequest.min.js"></scr' + 'ipt>');
}

// Fixing trim() function for IE8
if (typeof String.prototype.trim !== 'function') {
  String.prototype.trim = function() {
    return this.replace(/^\s+|\s+$/g, '');
  };
}

// var pageType = "Virtual Currency";
var scopeType = "defaultPayment";
var clientType = "zenimax.com";
var storeParam = {
  client: clientType,
  game: "battlecry",
  storeVersion: "v1",
  catalog: "default"
};

var validatePaymentForm;
var arrPaymentGroupType = {};

//override base setting
if(apiPath) {
  apiPath.offerUrl = function () {
    return this.urlPath + config.offer_v3 + '&language=' + authenticatedInfo.language + '&country=' + authenticatedInfo.countryIdentifier + '&client=' + clientType + '&referenceId=' + getUrlVars().referenceId + '&catalog=' + storeParam.catalog;
  };
}

$(function() {
  authenticate(apiPath.authenticateUrl(), {
    beforeSendCB: function(data) {
    	initUI();
      data.setRequestHeader('Accept-Language', storeLanguage);
      data.setRequestHeader('game', storeParam.game);
      data.setRequestHeader('storeVersion', storeParam.storeVersion);
    },
    successCB: function(response) {
      if (getUrlVars().transactionId !== null && getUrlVars().transactionId !== "") {
        paymentTransactionParameters.externalTransactionId = getUrlVars().transactionId;
      }

      CheckState("#ProductSelection");

      $.when(loadUserMetaData()).done(function() {
        if ( !paymentTransactionParameters.storeMaintenance ) {
          $.when( loadMetaData(apiPath.metaUrl()) ).done(function() {
            loadOfferInformation(apiPath.offerUrl());
          });
        } else {
          CheckState("#StoreMaintenance");
        }
      });
    }
  });
});

var CheckState = function(_hash) {
  if (!_hash) {
    _hash = location.hash;
  }

  hidePopupMessage();

  switch (_hash) {
    case "#StoreMaintenance":
      if ( $('.step-maintenance').length > 0 ) {
        $('.step_wrapper').hide();
        $('.step-maintenance .dr_maintenHeader').text($.localize("drog.storeMaintenance.header"));
        $('.step-maintenance .dr_maintenText').text($.localize("drog.storeMaintenance.displayValue"));
        $('.step-maintenance').show();
      }
      break;
    case "#SessionExpire":
      if ( $('.step-sessionExpire').length > 0 ) {
        $('.step_wrapper').hide();
        $('.step-sessionExpire .dr_expireText').text($.localize("drog.error.sessionexpire.alert"));
        $('.step-sessionExpire').show();
      }
      break;
    case "#ProductSelection":
      $('.step_wrapper').hide();
      $('.step-productSelection').show();
      break;
    case "#PaymentSelection":
      $('.step_wrapper').hide();
      $('.step-paymentSelection').removeClass('dr_orderConfirm').show();
      break;
    case "#ReviewYourOrder":
      $('.step_wrapper').hide();
      $('.step-paymentSelection').addClass('dr_orderConfirm').show();
      break;
    case "#CompleteOrder":
      $('.step_wrapper').hide();
      $('.step-complete').show();
      break;

  }
};


function loadUserMetaData() {
	return $.ajax({
		url: apiPath.userMetaUrl() + getHeaderParams(),
    xhrFields: {
      withCredentials: true
    },
    cache: false,
    dataType: config.default_dataType,
    jsonpCallback: "callback",
    beforeSend: setHeader
	})
	.fail(function(xhr, ajaxOptions, thrownError) {
		console.log("url: " + apiPath.userMetaUrl());
    console.log("fn loadUserMetaData xhr.status: " + xhr.status);
    console.log("fn loadUserMetaData xhr.responseText: " + xhr.responseText);
    console.log("fn loadUserMetaData thrownError: " + thrownError);
	})
	.done(function(data) {
		updateSellingEntity(data);

		if (data.address.length > 0 && typeof data.address[0].accountId !== "undefined" && data.address[0].accountId !== null) {
      bindAddressData(data.address[0]);
    } else {
    	//added condition when there's only email address
      if (data.address.length > 0 && typeof data.address[0].email !== "undefined" && data.address[0].email !== null) {
        paymentTransactionParameters.addressInfo.email = data.address[0].email;
        $('.input_account').html(data.address[0].email).data('account', data.address[0].email);
      }
    }

    if (typeof data.recurringBuyer !== "undefined") {
      paymentTransactionParameters.recurringBuyer = data.recurringBuyer;
    }
    if (typeof data.returningUserShouldEnterCVV !== "undefined") {
      paymentTransactionParameters.returningUserShouldEnterCVV = data.returningUserShouldEnterCVV;
    }

    var hasDefaultPayment = false;
    if (data.paymentTypes.length > 0) {
    	//reset all payment types
    	paymentTransactionParameters.paymentFormId = null;
    	arrPaymentGroupType = {};

    	$.each(data.paymentTypes, function(index, pmt) {
    	  hasDefaultPayment = pmt.defaultPayment ? pmt.defaultPayment : hasDefaultPayment;
    	  bindPaymentData(pmt);

    	  if (pmt.defaultPayment) {
    	    //defaultPayment for recurring buyer, take scope != null
    	    if (!paymentTransactionParameters.recurringBuyer || (paymentTransactionParameters.recurringBuyer && (pmt.scope !== null))) {
    	    	$('#select-paymentType').val(pmt.paymentType).trigger('change');
    	    }
    	  }
    	  arrPaymentGroupType[pmt.paymentType] = pmt.paymentGroupType;
    	});

    }

    // To show default payment type
    if( !hasDefaultPayment || $('.dr_paymentMethodBox').css('display') == 'none' ) {
      $('#select-paymentType').trigger('change');
    }

    if (typeof data.userLocalizationData !== "undefined") {
      if (typeof data.userLocalizationData.language !== "undefined") {
        authenticatedInfo.language = data.userLocalizationData.language;
      }
      if (typeof data.userLocalizationData.countryIdentifier !== "undefined") {
        //DROG-6251 avoid reload offer if address.countryId conflicts with userLocalizationData.countryIdentifier
        if (paymentTransactionParameters.addressInfo.countryId && paymentTransactionParameters.addressInfo.countryId !== '') {
          authenticatedInfo.countryIdentifier = paymentTransactionParameters.addressInfo.countryId;
        } else {
          authenticatedInfo.countryIdentifier = data.userLocalizationData.countryIdentifier;
        }
      }
      if (typeof data.userLocalizationData.currencyIdentifier !== "undefined") {
        paymentTransactionParameters.currencyIdentifier = data.userLocalizationData.currencyIdentifier;
        paymentTransactionParameters.currencySymbol = currencySymbol(paymentTransactionParameters.currencyIdentifier);
      }
    }

    // IBP payment related
    // if (data.banks && typeof data.banks !== 'undefined' && (data.banks.length > 0)) {
    //   var bank_select = $("#ibpBankName");
    //   $("#ibpBankOptions").html("");
    //   for (var index in data.banks) {
    //     var bank = data.banks[index];
    //     $("#ibpBankOptions").append($("<li></li>").text(bank.bankName).attr('bank-id', bank.bankId));
    //   }
    //   $(bank_select).data("banks", data.banks);
    // }

    // $("#paymentList").data("value", data.identities);

    if (typeof data.storeMaintenance !== 'undefined') {
      paymentTransactionParameters.storeMaintenance = data.storeMaintenance;
    }

    DetermineErrMsg();
	});
}

function loadMetaData(url) {
	return $.ajax({
		url: url,
		xhrFields: { 
      withCredentials: true 
    },
    dataType: config.default_dataType,
    jsonpCallback: "callback"
	})
	.fail(function(xhr, ajaxOptions, thrownError) {
		console.log("url: " + url);
    console.log("fn loadMetaData xhr.status: " + xhr.status);
    console.log("fn loadMetaData xhr.responseText: " + xhr.responseText);
    console.log("fn loadMetaData thrownError: " + thrownError);
	})
	.done(function(data) {
		// store properties
    storeProperties = data.storeProperties;

    //terms and conditions link
    var terms = data.termsConditions;
    paymentTransactionParameters.terms = terms;
    displayTermsAndConditionLinks(terms);

    var $countrySelect = $('#select-country');
    $.each(data.countries, function(index, country) {
    	 $countrySelect.append(
    	 	$('<option></option>').val(country.shortDescription).html(country.localizedName).data('states', country.states).attr('data-text', country.localizedName)
    	 );
    });

    bindUserData();
	});
}

function loadOfferInformation(url, callbackFn) {
  loadAjaxData(url + getHeaderParams(), {beforeSendCB: setHeader,
    successCB: function(data) {
    	$('.dr_offerList').empty().data('offer', data);

      if (data.length > 0) {
      	var content = '';
        $.each(data, function(index, offer) {
        	var offerImg = (offer.images && offer.images.length > 0 && offer.images[0].uri) ? offer.images[0].uri : 'images/img_offer01.png';

        	content += '<li data-offer-id="' + offer.id + '" data-price-id="' + offer.prices[0].id + '">' +
											'<div class="dr_offerImg"><img src="' + offerImg + '"></div>' +
											'<div class="dr_offerOverlay">' +
												'<div class="dr_offerName">' + getObjectByLocale(offer.descriptions, storeLanguage).name + '</div>' +
												'<div class="dr_offerGold">' + getObjectByLocale(offer.descriptions, storeLanguage).short + '</div>' +
												'<div class="dr_offerPrice clearfix">' +
													formatedPrice(offer.prices[0], false, true) +
												'</div>' +
											'</div>' +
                      '<div class="dr_offerSpecialTop">' +
                        discountOfferHandler(offer.prices[0]) +
                        countdownOfferHandler(offer, new Date().getTime()) +
                      '</div>' +
                      '<div class="dr_offerSpecialBottom">' +
                        bonusOfferHandler(offer, false) +
                      '</div>' +
										'</li>';
        });

        $('.dr_offerList').html(content);

        $('.dr_countdownText').each(function(index, el) {
          var cd_seconds = $(el).data('seconds');
          var countdownFormate = (parseInt(cd_seconds) < 3600) ? '%Mm:%Ss' : '%Hh:%Mm';

          $(el).countdown('', cd_seconds, countdownFormate);
        });

        // Set currencyIdentifier to be the currency of the first offer (DROG-5407)
        var firstOffer = (data.length > 5 && paymentTransactionParameters.recurringBuyer) ? data[1] : data[0];
        var _price = firstOffer.prices[0];
        paymentTransactionParameters.currencyIdentifier = (_price.price && typeof _price.price.isoCode !== 'undefined') ? _price.price.isoCode : _price.currency;

      }

      if(typeof callbackFn === 'function') {
        callbackFn();
      }
    }
  });
}

function updateSellingEntity(data) {
  if (data && data.sellingEntity) {
    // change selling entity in the footer
    $("#selling_entity").text(data.sellingEntity.footer);

    paymentTransactionParameters.sellingEntity = data.sellingEntity;
  }
}

function displayTermsAndConditionLinks(terms) {
  if (terms) {
    if ( terms.termsAndConditionsId !== null ) {
      paymentTransactionParameters.termsAndConditionsId = terms.termsAndConditionsId;
    }
    $("a.dr_privacyPolicy").attr("href", decodeURIComponent(terms.privacyPolicyLink));
    $("a.dr_termsSales").attr("href", decodeURIComponent(terms.termsOfSaleLink));
    // $("#footer a.dr_legalNotice").attr("href", decodeURIComponent(terms.legalNoticeLink));
  }
}

function bindUserData() {
  //Bind user data
  var address = paymentTransactionParameters.addressInfo;
  if (address.accountId) {
    $("#firstname").val(address.firstName);
    $("#lastname").val(address.lastName);
    $("#address").val(address.street1 ? address.street1 : "");
    $("#address-extra").val(address.street2 ? address.street2 : "");
    $("#zipcode").val(address.zip);
    $("#city").val(address.city);
    $("#phone").val(address.phone);
    $("#email").val(address.email);
    $('.input_account').html(address.email).data('account', address.email);

    // To bind user's country and state 
    if (address.countryId) {
      $("#select-country").val(address.countryId).trigger("change");
      if (address.stateId) {
        $("#select-state").val(address.stateId);
        var stateData = $('#state').data('states');
      } else if (address.stateText) {
      	$("#select-state").val($('#select-state option[data-text="' + address.stateText + '"]').val());
      }
    }

    $('#select-state').trigger('render');

    $('.cb_saveInfo').addClass('checked');

  } else if ( authenticatedInfo.countryIdentifier ) {
    $("#select-country").val(authenticatedInfo.countryIdentifier).trigger("change");
  }

  // bind user's credit card data
  var creditCard = paymentTransactionParameters.creditCard;
  if (creditCard.creditCardExternalId) {
    $("#cardSecurityCode").val("***");
    $('#cardSecurityCode').rules('remove', 'number');
    $("#cardExpirationMonth").val(creditCard.expiresMonthForUI);
    $("#cardExpirationYear").val(creditCard.expiresYearForUI);
    $("#cardNumber").val("************" + creditCard.lastFourDigits);
    $('#cardNumber').rules('remove', 'supportedCard');

    // if (paymentTransactionParameters.recurringBuyer && creditCard.lastFourDigits) {
    //   var pmtOption = $("li[for='cpgCreditCard']");
    //   pmtOption.find('span').text(' (' + creditCard.type + '-****' + creditCard.lastFourDigits + ')');
    // }

    $('.img_cardType').addClass(creditCard.type).data('type', creditCard.type);

    if (paymentTransactionParameters.returningUserShouldEnterCVV) {
      $("#cardSecurityCode").val('');
    }
  }

  // var elvForm = paymentTransactionParameters.ELV;
  // if (elvForm.bankBillingInfoExternalId) {
  //   $("#bankName").val(elvForm.bankName);
  //   $("#bankRoutingCode").val(elvForm.bankBranchNumber);
  //   $("#bankAccountHolder").val(elvForm.bankAccountHolder);
  //   $("#bankAccountNumber").val("******" + elvForm.displayValue);
  //   $('#bankAccountNumber').rules('remove', 'number');
  //   $(".save input[for=cpgELV]").attr("checked", "checked");
  // }
  // var sddForm = paymentTransactionParameters.SDD;
  // if (sddForm.bankBillingInfoExternalId) {
  //   $("#sdd_bankRoutingCode").val(sddForm.bankBranchNumber);
  //   $("#sdd_bankAccountNumber").val("******" + sddForm.displayValue);
  //   $('#sdd_bankAccountNumber').rules('remove', 'sepa_validAccountNumber');
  //   $(".save input[for=cpgSEPADirectDebit]").attr("checked", "checked");
  // }
  // var ibpForm = paymentTransactionParameters.bankBilling;
  // if (ibpForm.bankBillingInfoExternalId) {
  //   if ($('#ibpBankOptions li[bank-id=' + ibpForm.bankBranchNumber + ']').length) {
  //     $("#ibpBankName").attr('bank-id', ibpForm.bankBranchNumber).val(ibpForm.bankName);
  //     $(".save input[for=cpgIBP]").attr("checked", "checked");
  //   }
  // }
}

var initUI = function() {
	bindEventHandler();
	paymentFormValidator();

	paymentTransactionParameters.paymentFormId = null;
  // $("#paymentList #paymentloading").show();

  var $expiresYear = $("#cardExpirationYear");
  var year = new Date().getFullYear();

  $expiresYear.empty();
  for (var i = 0; i <= 15; i++) {
    $expiresYear.append($("<option></option>").text(year + i).val(year + i));
  }

  var month = new Date().getMonth() + 1;
  $('#cardExpirationMonth').val(month);

  $('#select-paymentType').empty().html($('#select-paymentType-hidden option').clone());

  // init custom select drop down
  $('#payment-section .dr_inputBox select').each(function() {
    var item_id = $(this).attr('id');
    if ( item_id.indexOf('hidden') == -1 ) {
      var customClassName = item_id + '-customSelect';
      $(this).customSelect({
        customClass: customClassName
      });
    }
    
  });

  setBattleCryLinks();

};

var expireTimer;

function setHeader(xhr) {
  xhr.setRequestHeader('Authorization', 'Bearer ' + authenticatedInfo.access_token);
  xhr.setRequestHeader('Accept-Language', storeLanguage);
  xhr.setRequestHeader('game', storeParam.game);
  xhr.setRequestHeader('storeVersion', storeParam.storeVersion);
  //Session expired in 5 mins 5*60=300s (default)
  clearInterval(expireTimer);
  var expires_in = authenticatedInfo.expires_in || 300;
  expireTimer = setInterval(function(){CheckState("#SessionExpire");}, expires_in*1000);
  console.log("Reset expire timer. Expires in " + expires_in + " seconds.");
}

var getHeaderParams = function() {
  var headerParams = '';
  if ( internetExplorer9andLess() ) {
    headerParams = '&access_token=' + authenticatedInfo.access_token + '&accept_language=' + storeLanguage + '&game=' + storeParam.game + '&storeVersion=' + storeParam.storeVersion;
  }
  return headerParams;
};

/**
 * IE9 and IE8 support CORS POST request only with 'text/plain' content type
 * @returns {string}
 */
var getContentType = function() {
  var contentType = 'application/json';
  if (internetExplorer9andLess()) {
    contentType = 'text/plain';
  }
  return contentType;
};

var bindEventHandler = function() {
	$(document).on('click', '.dr_offerList li', function(event) {
		event.preventDefault();
		var offer_id = $(this).data('offer-id');
		if (offer_id) {
			setOfferDetail(offer_id);
			paymentOptionHandler();
			$(this).addClass('selected');
			CheckState('#PaymentSelection');
		}
	});

	$(document).on('click', '.dr_saveInfoWrapper > div', function(event) {
		event.preventDefault();
		var $cb_saveInfo = $('.dr_saveInfoWrapper .cb_saveInfo');
		$cb_saveInfo.toggleClass('checked');
	});

	$(document).on('click', '.dr_paymentWrapper .btn_next', function(event) {
		event.preventDefault();
		sendBillingForm();
	});

	$(document).on('click', '.cb_AcceptTerms .cb_icon, .cb_AcceptPolicy .cb_icon', function(event) {
		event.preventDefault();
		$(this).removeClass('invalid').toggleClass('checked');

		if ( $('.cb_AcceptTerms .cb_icon').hasClass('checked') && $('.cb_AcceptPolicy .cb_icon').hasClass('checked') ) {
			hidePopupMessage();
		}
	});

	$(document).on('click', '.dr_confirmButtons .btn_purchase', function(event) {
		event.preventDefault();
		sendConfirmForm();
	});

	$(document).on('click', '.button_edit', function(event) {
		event.preventDefault();
		CheckState('#PaymentSelection');
	});

	$(document).on('click', '.btn_backToStore', function(event) {
		event.preventDefault();
		if ( !$(this).hasClass('disabled') ) {
			CheckState('#ProductSelection');
		}
	});

	$(document).on('click', '.btn_closePopup', function(event) {
		event.preventDefault();
		hidePopupMessage();
	});

	$("#payment-section, #sddMandateForm").submit(function() {
    return false;
  });

	$(document).on('change', '#select-country', function(event) {
		event.preventDefault();
		countryDropListHandler();
		$('.cb_AcceptTerms, .cb_AcceptPolicy').find('.cb_icon').removeClass('checked');

		var countryCode = $(this).val();

    if (countryCode == "USA" || countryCode === "") {
      $('#zipcode').rules('remove','forZipFilter');

      if(!$('#zipcode').rules().forUSZipFilter) {
        $('#zipcode').rules('add',{ forUSZipFilter:true });
      }

      if ( paymentTransactionParameters.recurringBuyer ) {
        $('.cb_AcceptTerms, .cb_AcceptPolicy').find('.cb_icon').addClass('checked');
      }

    } else {
      $('#zipcode').rules('remove','forUSZipFilter');

      if ( !$('#zipcode').rules().forZipFilter ) {
        $('#zipcode').rules('add',{ forZipFilter:true });
      }

      $('input#agreeTerms').removeAttr('checked');
    }

    if ( countryCode && countryCode != authenticatedInfo.countryIdentifier ) {
    	authenticatedInfo.countryIdentifier = countryCode;

    	//update Terms of Sale link by countryId
      loadAjaxData(apiPath.metaUrl(), {successCB: function(data) {
        //terms and conditions link
        var terms = data.termsConditions;
        paymentTransactionParameters.terms = terms;
        displayTermsAndConditionLinks(terms);
      }});

      // refresh offers and update payment forms
      loadOfferInformation( apiPath.offerUrl(), fn_reloadUserMeta );

      if( paymentTransactionParameters.addressInfo.countryId && countryCode == paymentTransactionParameters.addressInfo.countryId ) {
        //the same country, rebind user data
        bindUserData();
      } else {
        //reset address info
        $('#address, #address-extra, #city, #zipcode').val('');
      }

    }

    if(countryCode == 'AUT') {
      $('#bankAccountNumber').rules('remove','maxlength');
      $('#bankAccountNumber').rules('add',{ maxlength: 11});
      $('#bankRoutingCode').rules('remove','maxlength');
      $('#bankRoutingCode').rules('add',{ maxlength: 5});
      $('#dr_ELVForm .routing').show();
    }
     if(countryCode == 'DEU') {
      $('#bankAccountNumber').rules('remove','maxlength');
      $('#bankAccountNumber').rules('add',{ maxlength: 12});
      $('#bankRoutingCode').rules('remove','maxlength');
      $('#bankRoutingCode').rules('add',{ maxlength: 8});
      $('#dr_ELVForm .routing').show();
    }
     if(countryCode == 'NLD') {
      $('#bankAccountNumber').rules('remove','maxlength');
      $('#bankAccountNumber').rules('add',{ maxlength: 10});
      $('#bankRoutingCode').rules('remove','maxlength');
      $('#dr_ELVForm .routing').hide();
    }

	});

	$(document).on('change', '#select-paymentType', function(event) {
		event.preventDefault();
		$('.dr_paymentMethodBox').hide();

		var payment_id = $(this).val();
		if ( payment_id ) {
			paymentTransactionParameters.paymentFormId = payment_id;
			$('.dr_paymentMethodBox[for*="' + payment_id + '"]').show();
		}
	});

	$(document).on('focus', '#cardNumber', function(event) {
		event.preventDefault();
    if ( $(this).val().indexOf("*") != -1 ) {
      $('#cardNumber, #cardSecurityCode, #cardExpirationMonth, #cardExpirationYear').val('');
      $('.img_cardType').removeAttr('class').addClass('img_cardType');
      $('.cb_saveInfo').removeClass('checked');
      $('.dr_paymentMethodBox[for="cpgCreditCard"] select').trigger('render');
    }
  });

  $(document).on('keyup', '#cardNumber', function(event) {
  	event.preventDefault();
    if ($(this).val().indexOf("****") != -1) {
      $('#cardNumber').rules('remove','supportedCard');
    } else {
      if(!$('#cardNumber').rules().supportedCard){
        $('#cardNumber').rules('add',{ supportedCard:true });
      }
      $('#cardNumber').val($('#cardNumber').val().replace(/[^0-9]/g, ''));
      getCreditCardType($("#cardNumber").val());
    }
  });

  $(document).on('change', '#cardSecurityCode', function(event) {
  	event.preventDefault();
    if ( $(this).val().indexOf("***") != -1 ) {
      $('#cardSecurityCode').rules('remove','number');
    } else {
      if( !$('#cardSecurityCode').rules()['number'] ){
        $('#cardSecurityCode').rules('add',{ number:true });
        $('#cardSecurityCode').val($('#cardSecurityCode').val().replace(/[^0-9]/g, ''));
      }
    }
  });

  $(document).on('keydown', '#cardNumber', function(event) {
    // Allow: backspace, delete, tab, escape, and enter
    if (event.keyCode == 46 || event.keyCode == 8 || event.keyCode == 9 || event.keyCode == 27 || event.keyCode == 13 ||
      // Allow: Ctrl+A
      (event.keyCode == 65 && event.ctrlKey === true) ||
      // Allow: home, end, left, right
      (event.keyCode >= 35 && event.keyCode <= 39)) {
      // let it happen, don't do anything
      return;
    } else {
      // Ensure that it is a number and stop the keypress
      if (event.shiftKey || (event.keyCode < 48 || event.keyCode > 57) && (event.keyCode < 95 || event.keyCode > 105)) {
        event.preventDefault();
      }
    }
  });

  $(document).on('blur', '#cardNumber', function(event) {
    getCreditCardType($("#cardNumber").val());
  });

  $('.btn_cvcInfo').hover(function () {
      $('.cvv_hint').show();
    },
    function () {
      $('.cvv_hint').hide();
  });

};

var setOfferDetail = function(offer_id) {
	var offerList = $('.dr_offerList').data('offer');
	var selectedOffer;

	$.each(offerList, function(index, offer) {
		if ( offer.id == offer_id ) {
			selectedOffer = offer;
			return false;
		}
	});

	if ( selectedOffer ) {
		var selectedOfferDesc = getObjectByLocale(selectedOffer.descriptions, storeLanguage);

		$('.dr_offerInfo .dr_offerGold').html(selectedOfferDesc.short);

		$('.dr_offerInfo .dr_offerPrice').html(formatedPrice(selectedOffer.prices[0], false, true) + discountOfferHandler(selectedOffer.prices[0]));

		if ( selectedOffer.items && selectedOffer.items.length > 0 ) {
			$('.dr_offerInfo .dr_detailList').html(getObjectByLocale(selectedOffer.items[0].descriptions, storeLanguage)['long']).show();

			var itemImg = ( selectedOffer.items[0].images && selectedOffer.items[0].images.length > 0 && selectedOffer.items[0].images[0].uri ) ? selectedOffer.items[0].images[0].uri : selectedOffer.images[0].uri;
			$('.dr_offerThumbnail .dr_countdown').remove();
      $('.dr_offerThumbnail .dr_itemImg').html('<img src="' + itemImg + '">').after(countdownOfferHandler(selectedOffer, new Date().getTime()));

      // set countdown offer in offer details
      if ( $('.dr_offerThumbnail .dr_countdown').length > 0 ) {
        var cd_seconds = $('.dr_offerThumbnail .dr_countdownText').data('seconds');
        var countdownFormate = (parseInt(cd_seconds) < 3600) ? '%Mm:%Ss' : '%Hh:%Mm';
        $('.dr_offerThumbnail .dr_countdownText').countdown('', cd_seconds, countdownFormate);
      }

      // set bonus offer in offer details
      $('.dr_packageContent .dr_bonusGold').remove();
      $('.dr_packageContent').append( bonusOfferHandler(selectedOffer, true) );
		}

		$('.dr_offerDetail .dr_longDesc').html(selectedOfferDesc['long']);

		bindOfferData(selectedOffer);
		
	}
};

var bindOfferData = function(selectedOffer) {
  paymentTransactionParameters.selectedOffer = selectedOffer;
  paymentTransactionParameters.offerId = selectedOffer.id;

  var _price = selectedOffer.prices[0];
  paymentTransactionParameters.priceId = _price.id;
  paymentTransactionParameters.currencyIdentifier = (_price.price && typeof _price.price.isoCode !== 'undefined') ? _price.price.isoCode : _price.currency;
  paymentTransactionParameters.currencySymbol = currencySymbol(paymentTransactionParameters.currencyIdentifier);
};

var countryDropListHandler = function() {
	$('.dr_billingInfo .rowspan_2').removeClass('hasState');

	$('#select-state').empty();

	var statesList = $('#select-country option:selected').data('states');
	if ( statesList && statesList.length > 0 ) {
		var $stateSelect = $('#select-state');
		$.each(statesList, function(index, state) {
			$stateSelect.append(
				$('<option></option>').val(state.shortDescription).html(state.localizedName).attr('data-text', state.localizedName)
			);
		});
		$('.dr_billingInfo .rowspan_2').addClass('hasState');
	}

  $('#select-state').trigger('render');
};

function sendBillingForm() {
  $("#payment-section").submit();
  if ( validatePaymentForm.numberOfInvalids() ) {
    popupMessage($.localize('drog.error.validation.alert'));

  } else {
    var payment_id = paymentTransactionParameters.paymentFormId;
    var billingdata = getBillingData(payment_id);
    // FOR TESTING
    // console.log(billingdata);

    // STORE PAYMENT METHOD call
    $.ajax({
      type: config.debug ? "GET" : "POST",
      url: apiPath.paymentUpdateUrl() + getHeaderParams(),
      xhrFields: { 
        withCredentials: true 
      },
      dataType: config.default_dataType,
      contentType: getContentType(),
      jsonpCallback: "callback",
      data: JSON.stringify(billingdata),
      beforeSend : setHeader,
      error: function (xhr, ajaxOptions, thrownError) {
        console.log("url: " + apiPath.paymentUpdateUrl());
        console.log("fn sendBillingForm xhr.status: " + xhr.status);
        console.log("fn sendBillingForm xhr.responseText: " + xhr.responseText);
        console.log("fn sendBillingForm thrownError: " + thrownError);
        // window.setTimeout(function() {
        // 	$("#ajax_overlay").fadeOut(0);
        // }, 800);
      },
      success: function (data) {
        // FOR TESTING
        // console.log('payment update API call');
        // console.log(data);
        // $('.cbox_AcceptTerms span.sellerName').text(paymentTransactionParameters.sellingEntity.text);
        updateAddress(data.modifiedAddress);
        paymentTransactionParameters.addressId = data.addressId;
        paymentTransactionParameters.creditCardId = data.creditCardId;

        sendAuthorizePayment();
      }
    });
    // return true;
  }
  // return false;
}

function updateAddress(modifiedAddress) {
  if( modifiedAddress ){
    $("#address").val(modifiedAddress.street1);
    $("#address-extra").val(modifiedAddress.street2 ? modifiedAddress.street2 : "");
    $("#zipcode").val(modifiedAddress.zipCode);
    $("#city").val(modifiedAddress.city);
    if ( $("#state").val() ){
      $("#state").val(modifiedAddress.stateCode);
      // $("#state").trigger('render');
    }
  }
}

function sendAuthorizePayment() {
  var fmt = new DateFmt();
  var CONST_CURRENCY = paymentTransactionParameters.currencyIdentifier || "USD";

  // get external price point id
  var externalPricePointId = null;
  var selectedOffer = paymentTransactionParameters.selectedOffer;
  for (var priceIndex in selectedOffer.prices) {
    var _price = selectedOffer.prices[priceIndex];
    if (_price.price && typeof _price.price.isoCode !== 'undefined') {
      //offer v3 format
      if (_price.price.isoCode === CONST_CURRENCY) {
        externalPricePointId = selectedOffer.prices[priceIndex].id;
      }
    } else if (_price.price && typeof _price.currency !== 'undefined') {
      if (_price.currency === CONST_CURRENCY) {
        //offer v2 format
        externalPricePointId = selectedOffer.prices[priceIndex].id;
      }
    }
  }

  var confirmdata = {
    "addressId": paymentTransactionParameters.addressId,
    "paymentType": paymentTransactionParameters.paymentFormId,
    "quantity": 1,
    "price": {
      "id": ((paymentTransactionParameters.ssoPriceId === null)?externalPricePointId:paymentTransactionParameters.ssoPriceId) || paymentTransactionParameters.priceId
    },
    "externalTransactionId": paymentTransactionParameters.externalTransactionId
  };

  var payment_id = paymentTransactionParameters.paymentFormId;
  if ( payment_id == 'cpgCreditCard' ) {
    confirmdata.creditCardId = paymentTransactionParameters.creditCardId;
  } else if ( payment_id == 'cpgELV' || payment_id == 'cpgSEPADirectDebit' || payment_id == 'cpgIBP' || payment_id == 'cpgYandexMoney' ) {
    confirmdata.creditCardId = null;
    confirmdata.bankBillingInfoId = paymentTransactionParameters.bankBillingInfoId;
  } else if ( payment_id == 'cpgKonbini' || payment_id == 'cpgPayEasy' || payment_id == 'cpgSevenElevenShop' ) {
    confirmdata.referenceBillingInfoId = paymentTransactionParameters.referenceBillingInfoId;
  }

  // FOR TESTING
  // console.log("authorize confirmdata");
  // console.log(confirmdata);
  
  // AUTHORIZE PAYMENT call
  $.ajax({
    type: config.debug ? "GET" : "POST",
    url: apiPath.authorizeUrl() + getHeaderParams(),
    xhrFields: { 
        withCredentials: true 
      },
    dataType: config.default_dataType,
    contentType: getContentType(),
    jsonpCallback: "callback",
    data: JSON.stringify(confirmdata),
    beforeSend: setHeader,
    error: function (xhr, ajaxOptions, thrownError) {
      console.log("fn authenticate xhr.status: " + xhr.status);
      console.log("fn authenticate xhr.responseText: " + xhr.responseText);
      console.log("fn authenticate thrownError: " + thrownError);
    },
    success: function (data) {
      // FOR TESTING
      // console.log('authorize API call');
      // console.log(data);
      paymentTransactionParameters.transactionId = data.transactionId;
      var offer = paymentTransactionParameters.selectedOffer;
      var price = matchPriceId(offer, paymentTransactionParameters.ssoPriceId) || offer.prices[0];

      $(".dr_confirmList .dr_offerGold").text(getObjectByLocale(paymentTransactionParameters.selectedOffer.descriptions, storeLanguage).short);
      $(".dr_confirmList .dr_subTotal").text(formatedPrice(data.amount, true));
      $(".dr_confirmList .dr_priceTax").text(formatedPrice(data.tax, true));
      $(".dr_confirmList .dr_priceTotal").text(formatedPrice(data.amountTotal, true));

      setPaymentInfo();

      updateSellingEntity(data);
      // $('.cbox_AcceptTerms span.sellerName').text(paymentTransactionParameters.sellingEntity.text);
      
      // addDNSPixel(data);
      CheckState("#ReviewYourOrder");
    }
  });
  // return true;
}

function sendConfirmForm() {
	var isExternalWindow = false;

  // if( paymentTransactionParameters.paymentFormId == 'cpgSEPADirectDebit' ) {
  //   $("#sddMandateForm").submit();
  //   if (SEPAConfirmForm.numberOfInvalids() || !agreeSEPAValidation()) {
  //     return false;
  //   }
  // }

  if ( $('.cb_AcceptTerms .cb_icon').hasClass('checked') && $('.cb_AcceptPolicy .cb_icon').hasClass('checked') ) {
    var fmt = new DateFmt();
    var payment_id = paymentTransactionParameters.paymentFormId;
    var confirmdata = {
      transactionId: paymentTransactionParameters.transactionId,
      termsAndConditionsId: paymentTransactionParameters.termsAndConditionsId,
      timeZoneInfo: getTimeZoneInfo()
    };

    if ( payment_id == 'cpgCreditCard' ) {
      confirmdata.creditCardCvc = paymentTransactionParameters.creditCard.securityCode;
    }

    // FOR TESTING
    // console.log("capture confirmdata");
    // console.log(confirmdata);

    // popup window in advance
    if ( arrPaymentGroupType[payment_id] == 'newWindow' ) {  
      paypalWindow = window.open( "loading.html", 'PayPal', 'width=800,height=600,resizable=yes,status=yes,screenX=50,screenY=50,top=50,left=50,scrollbars=yes' );
      isExternalWindow = true;
    }
    
    // CAPTURE PAYMENT call 
    $.ajax({
      type: config.debug ? "GET" : "POST",
      url: apiPath.captureUrl() + getHeaderParams(),
      xhrFields: { 
        withCredentials: true 
      },
      beforeSend: setHeader,
      dataType: config.default_dataType,
      contentType: getContentType(),
      jsonpCallback: "callback",
      data: JSON.stringify(confirmdata),
      error: globalErrorCaptureAPIHandler,
      success: function(data) {
        // FOR TESTING
        // console.log('capture API call');
        // console.log(data);
        var offer = paymentTransactionParameters.selectedOffer;
        var price = matchPriceId(offer, paymentTransactionParameters.ssoPriceId) || offer.prices[0];
        $(".dr_complete .dr_offerGold").text(getObjectByLocale(paymentTransactionParameters.selectedOffer.descriptions, storeLanguage).short);
	      $(".dr_completeList .dr_subTotal").text(formatedPrice(data.amount, true));
	      $(".dr_completeList .dr_priceTax").text(formatedPrice(data.tax, true));
	      $(".dr_completeList .dr_priceTotal").text(formatedPrice(data.amountTotal, true));

	      var html_paymentMethod = $('#select-paymentType option:selected').data('name');

				if ( paymentTransactionParameters.paymentFormId == 'cpgCreditCard' ) {
					html_paymentMethod = paymentTransactionParameters.creditCard.type + ' ' + $.localize('drog.text.credit.card.ending') + ' ' + paymentTransactionParameters.creditCard.lastFourDigits;
				}

				$(".dr_completeList .dr_completePayment").html(html_paymentMethod);

        paymentTransactionParameters.totalPrice = data.amountTotal;
        paymentTransactionParameters.subPrice = data.amount;

        // SUCCESS_PURCHASE or PENDING_PURCHASE
        if(typeof data.thankYouPageType != 'undefined' && data.thankYouPageType !== null) {
          paymentTransactionParameters.thankYouPageType = data.thankYouPageType;
        }
       
        var paymentName = $('#select-paymentType option:selected').data('name');

        if ( payment_id == 'cpgCreditCard' ) {
          CheckState("#CompleteOrder");

        } else if ( arrPaymentGroupType[payment_id] == 'newWindow' || arrPaymentGroupType[payment_id] == 'iFrame' ) {
          //External payment link
          if ( data.redirectURL ) {
            //extend token timeout              
            loadAjaxData(apiPath.authenticateUrl(), {beforeSendCB: setHeader}, function(response) {
              if (response.access_token) {
                authenticatedInfo.token_type = response.token_type;
                authenticatedInfo.access_token = response.access_token;
                authenticatedInfo.expires_in = response.expires_in;
              }
            });

            if ( arrPaymentGroupType[payment_id] == 'iFrame' ) {
              //hide all content and show iFrame only
              // $('div.step').hide();
              // if ( checkRedirectURL(data.redirectURL) == 'form') {
              //   var form = decodeURIComponent(data.redirectURL);
              //   $('#iframeBody iFrame').attr('class', payment_id).show();
              //   $(form).attr('target', 'my_iframe').submit();
              // } else if ( checkRedirectURL(data.redirectURL) == 'url' ) {
              //   $('#iframeBody iFrame').attr('class', payment_id).show().attr('src', data.redirectURL);
              // }

              // window.setTimeout('$("#ajax_overlay").fadeOut(0);', 800);

            } else {
              $('.dr_overlayWrapper').find('.dr_overlayText').html( replaceStringArgs($.localize('drog.payment.externalinfo.message'), [paymentName, data.redirectURL, paymentName]) );

              if ( checkRedirectURL(data.redirectURL) == 'form') {
                paymentTransactionParameters.externalUrl.formString = data.redirectURL;
              } else if ( checkRedirectURL(data.redirectURL) == 'url' ) {
                paypalWindow.location.href = data.redirectURL;
              }
              
              //IE cannot detect childwindow status normally
              if ( !$.browser.msie && !document.documentMode ) {
                window.setTimeout( function() {
                  paypalWindowTimer = setInterval(checkChild, 500);
                }, 3000);

              } else {
                var backtostoreString = '<a class="dr_overlayBtn" href="' + resolveBackToTheStoreLink() + '">' +
                                          $.localize("drog.text.back.to.store") +
                                        '</a>';
                $('.dr_overlayText').append(backtostoreString);
              }
            }
          }
        }
      }
    }).done(function() {
      if ( detectingIE() && isExternalWindow ) {
        var overlayTimer = setInterval(function() {
          if ( !$('.dr_overlayWrapper').is(':visible') ) {
            $('.dr_overlayWrapper').show();
            clearInterval(overlayTimer);
          }
        }, 50);
      }
    });

  } else {
  	if ( !$('.cb_AcceptTerms .cb_icon').hasClass('checked') ) {
  		$('.cb_AcceptTerms .cb_icon').addClass('invalid');
  	}
  	if ( !$('.cb_AcceptPolicy .cb_icon').hasClass('checked') ) {
  		$('.cb_AcceptPolicy .cb_icon').addClass('invalid');
  	}
    popupMessage($.localize("drog.terms.not.accepted"));
  }
}

function getBillingData(paymentType) {
  // get first and last name
  var firstName = $("#firstname").val().trim();
  var lastName = $("#lastname").val().trim();

  //map to paymentTransactionParameters
  paymentTransactionParameters.paymentFormId = paymentType;
  paymentTransactionParameters.addressInfo.city = $("#city").val().trim();
  paymentTransactionParameters.addressInfo.countryId = authenticatedInfo.countryIdentifier;
  paymentTransactionParameters.addressInfo.email = $(".input_account").data('account').trim();
  paymentTransactionParameters.addressInfo.firstName = firstName;
  paymentTransactionParameters.addressInfo.lastName = lastName;
  paymentTransactionParameters.addressInfo.stateId = $('#select-state').val();
  paymentTransactionParameters.addressInfo.street1 = $("#address").val().trim();
  paymentTransactionParameters.addressInfo.street2 = $("#address-extra").val().trim();
  paymentTransactionParameters.addressInfo.zip = $("#zipcode").val().trim();
  paymentTransactionParameters.addressInfo.phone = $("#phone").val().trim().replace(/[^\d]/g, '');
  
  paymentTransactionParameters.showDetailsInStore = $('.dr_saveInfoWrapper .cb_saveInfo').hasClass('checked');

  if (paymentType == 'cpgCreditCard') {
    paymentTransactionParameters.creditCard.expiresMonth = $("#cardExpirationMonth").val();
    paymentTransactionParameters.creditCard.expiresMonthForUI = $("#cardExpirationMonth").val();
    paymentTransactionParameters.creditCard.expiresYear = $("#cardExpirationYear").val();
    paymentTransactionParameters.creditCard.expiresYearForUI = $("#cardExpirationYear").val();
    paymentTransactionParameters.creditCard.name = firstName + " " + lastName;
    paymentTransactionParameters.creditCard.unencryptedNumber = $("#cardNumber").val();
    paymentTransactionParameters.creditCard.securityCode = $("#cardSecurityCode").val();
    paymentTransactionParameters.creditCard.type = $('.dr_paymentType .img_cardType').data('type');
    paymentTransactionParameters.creditCard.lastFourDigits = paymentTransactionParameters.creditCard.unencryptedNumber.substr(paymentTransactionParameters.creditCard.unencryptedNumber.length - 4);
  }

  // if(paymentType == 'cpgELV') {
  //     paymentTransactionParameters.ELV.bankBranchNumber = $("#bankRoutingCode").val();
  //     paymentTransactionParameters.ELV.bankName = $("#bankName").val();
  //     paymentTransactionParameters.ELV.bankAccountHolder = $("#bankAccountHolder").val();
  //     paymentTransactionParameters.ELV.unencryptedNumber = $("#bankAccountNumber").val();
  //     paymentTransactionParameters.ELV.displayValue = paymentTransactionParameters.ELV.unencryptedNumber.substr(paymentTransactionParameters.ELV.unencryptedNumber.length-4);
  // }
  // if(paymentType == 'cpgSEPADirectDebit') {
  //     paymentTransactionParameters.SDD.bankAccountHolder = firstName + " " + lastName;
  //     paymentTransactionParameters.SDD.bankBranchNumber = $("#sdd_bankRoutingCode").val();
  //     paymentTransactionParameters.SDD.unencryptedNumber = $("#sdd_bankAccountNumber").val();
  //     paymentTransactionParameters.SDD.displayValue = paymentTransactionParameters.SDD.unencryptedNumber.substr(paymentTransactionParameters.SDD.unencryptedNumber.length-4);
  // }
  // if(paymentType == 'cpgIBP') {
  //   var currentBankBranchNumber = $("#ibpBankName").attr("bank-id");
  //   if(paymentTransactionParameters.bankBilling.bankBranchNumber != currentBankBranchNumber){
  //     paymentTransactionParameters.bankBilling.bankBillingInfoExternalId = "";
  //   }
  //   paymentTransactionParameters.bankBilling.bankName = $("#ibpBankName").val();
  //   paymentTransactionParameters.bankBilling.bankBranchNumber = currentBankBranchNumber;
  // }

  var address = paymentTransactionParameters.addressInfo;
  var billingData = {
      showDetailsInStore: paymentTransactionParameters.showDetailsInStore, 
      paymentType : paymentType,
      scope : scopeType,
      address : {
        "firstName": firstName,
        "lastName": lastName,
        "city": address.city,
        "street1": address.street1,
        "street2" : address.street2,
        "zipCode": address.zip,
        "countryCode": address.countryId,
        "stateCode": address.stateId,
        "phone": address.phone,
        "email": address.email,
        "type": "billing"
      }
  };

  if ( paymentType == 'cpgCreditCard' ) {
    var creditCard = paymentTransactionParameters.creditCard;
    billingData.creditCard = {
      "expiresMonth": creditCard.expiresMonth,
      "expiresYear": creditCard.expiresYear,
      "name": creditCard.name,
      "unencryptedNumber": creditCard.unencryptedNumber,
      "securityCode": creditCard.securityCode,
      "type": creditCard.type,
      "externalId": paymentTransactionParameters.creditCardId || ""
    };
  }
  // if(paymentType == 'cpgELV') {
  //   var elvForm = paymentTransactionParameters.ELV;
  //   billingData.bankBilling = {
  //     "bankAccountNumber": elvForm.unencryptedNumber,
  //     "bankBranchNumber": elvForm.bankBranchNumber,
  //     "bankAccountHolder": elvForm.bankAccountHolder,
  //     "bankName": elvForm.bankName,
  //     "bankBillingInfoExternalId": elvForm.bankBillingInfoExternalId || ""
  //   };
  // }else if(paymentType == 'cpgSEPADirectDebit') {
  //   var sddForm = paymentTransactionParameters.SDD;
  //   billingData.bankBilling = {
  //     "bankAccountNumber": sddForm.unencryptedNumber,
  //     "bankBranchNumber": sddForm.bankBranchNumber,
  //     "bankAccountHolder": sddForm.bankAccountHolder,
  //     "bankBillingInfoExternalId": sddForm.bankBillingInfoExternalId || ""
  //   };
  // }else if(paymentType == 'cpgIBP') {
  //   var bankBilling = paymentTransactionParameters.bankBilling;
  //   billingData.bankBilling = {
  //     "bankName": bankBilling.bankName,
  //     "bankBranchNumber": bankBilling.bankBranchNumber,
  //     "bankBillingInfoExternalId": bankBilling.bankBillingInfoExternalId || ""
  //   };
  // }
  return billingData;
}

var setPaymentInfo = function() {
	var html_paymentMethod = $('#select-paymentType option:selected').data('name') + '<span class="button_edit">' + $.localize('drog.text.edit') + '</span>';

	if ( paymentTransactionParameters.paymentFormId == 'cpgCreditCard' ) {
		html_paymentMethod = paymentTransactionParameters.creditCard.type + ' ' + $.localize('drog.text.credit.card.ending') + ' ' + paymentTransactionParameters.creditCard.lastFourDigits + '<span class="button_edit">(Change)</span>';
	}
	var addressObj = paymentTransactionParameters.addressInfo;
	var address_extra = addressObj.street2 ? addressObj.street2 + '<br>' : '';
	var html_billingAdress = addressObj.firstName + ' ' + addressObj.lastName + '<br>' +
														addressObj.street1 + '<br>' +
														address_extra +
														addressObj.city + ' ' + $('#select-state option:selected').text() + '<br>' +
														addressObj.zip + '<br>' + 
														$('#select-country option:selected').text();

	$('.dr_paymentInfo .confirm_paymentType').html(html_paymentMethod);
	$('.dr_paymentInfo .confirm_address').html(html_billingAdress);
	$('.dr_paymentInfo .confirm_phone').html(addressObj.phone);
};

var paymentFormValidator = function() {
  validatePaymentForm = $("#payment-section").validate({
    errorClass: "invalid",
    validClass: "valid",
    rules: {
      firstname: {
        required: true,
        noNumbers: true,
        forValidSymbolFilter: true,
        minlength: 1,
        maxlength: 25
      },
      lastname: {
        required: true,
        noNumbers: true,
        forValidSymbolFilter: true,
        minlength: 1,
        maxlength: 25
      },
      address: {
        required: true,
        forValidSymbolFilter: true,
        minlength: 2,
        maxlength: 50
      },
      city: {
        required: true,
        forValidSymbolFilter: true,
        noNumbers: true,
        minlength: 2,
        maxlength: 50
      },
      zipcode: {
        required: true,
        forZipFilter: true,
        minlength: 2,
        maxlength: 10
      },
      // bankAccountHolder: "required forValidSymbolFilter forFirstNameLength forLastName forLastNameLength forFirstNameMinLength forLastNameMinLength noNumbers",
      // bankAccountNumber: {
      //   required: true,
      //   number: true,
      //   maxlength: 11
      // },
      // bankName: {
      //   required: true,
      //   alphanumeric: true,
      //   maxlength: 30
      // },
      // bankRoutingCode: {
      //   required: true,
      //   number: true,
      //   maxlength: 5
      // },
      // sdd_bankAccountNumber: {
      //   required: true,
      //   sepa_validAccountNumber: true
      // },
      // sdd_bankRoutingCode: {
      //   required: true,
      //   sepa_validBIC: true
      // },
      // ibpBankName: {
      //   required: true,
      //   validBankId: true
      // },
      // country: "required",
      // state: "required",
      cardNumber: {
        required: true,
        //creditcard: true,
        supportedCard: true,
        minlength: 12,
        maxlength: 19
      },
      cardSecurityCode: {
        required: true,
        minlength: 3,
        maxlength: 3
      },
      cardExpirationMonth: {
        required: true,
        CCExp: {
          month: '#cardExpirationMonth',
          year: '#cardExpirationYear'
        }
      },
      cardExpirationYear: {
        required: true,
        CCExp: {
          month: '#cardExpirationMonth',
          year: '#cardExpirationYear'
        }
      },
      phone: "required forPhoneFilter"
    },
    groups: {
      ccExpGroup: "cardExpirationMonth cardExpirationYear"
    },
    errorPlacement: function(error, element) {
      popupMessage($.localize('drog.error.validation.alert'));
    },
    highlight: function(element, errorClass, validClass) {
      $(element).addClass(errorClass).removeClass(validClass);
      // $("div.step-card .next").attr("disabled", "true");
      popupMessage($.localize('drog.error.validation.alert'));
    },
    unhighlight: function(element, errorClass, validClass) {
      $(element).removeClass(errorClass).addClass(validClass);
      
      if ( !this.numberOfInvalids() ) {
        hidePopupMessage();
      }
    }
  });

  // $("#sddMandateForm").validate({
  //   errorClass: "invalid",
  //   validClass: "valid",
  //   rules: {
  //     signEmail: {
  //       required: true,
  //       email: true
  //     },
  //     agreeSEPA: {
  //       required: true,
  //       minlength: 1
  //     }
  //   },
  //   messages: {
  //     agreeSEPA: $.localize("drog.sepa.mandate.please.agreeterms"),
  //     signEmail: $.localize("drog.please.enter.a.valid.email.address")
  //   },
  //   errorPlacement: function(error, element) {
  //     popupMessage(error.text());
  //   },
  //   highlight: function(element, errorClass, validClass) {
  //     $(element).addClass(errorClass).removeClass(validClass);
  //     $("div.step-review .confirm").attr("disabled", "true");
  //   },
  //   unhighlight: function(element, errorClass, validClass) {
  //     $(element).removeClass(errorClass).addClass(validClass);
  //     hidePopupMessage();
  //     if (!this.numberOfInvalids()) {
  //       $("div.step-review .confirm").removeAttr("disabled");
  //     }
  //   }
  // });
};

var getCreditCardType = function(accountNumber) {
  //start without knowing the credit card type
  var result = "unknown";
  //first check for MasterCard
  if (/^(?:5[1-5][0-9]{14})$/.test(accountNumber)) {
    result = "MASTERCARD";
  } else if (/^(?:4[0-9]{12}(?:[0-9]{3})?)$/.test(accountNumber)) { //then check for Visa
    result = "VISA";
  } else if (/^(?:3[47][0-9]{13})$/.test(accountNumber)) { //then check for AmEx
    result = "AMEX";
  } else if (/^(?:6(?:011|5[0-9][0-9])[0-9]{12})$/.test(accountNumber)) { //then check for Discover
    result = "DISCOVER";
  } else if (/^(?:(?:2131|1800|35\d{3})\d{11})$/.test(accountNumber)) { //then check for JCB
    result = "JCB";
  } else if (/^(?:3(?:0[0-5]|[68][0-9])[0-9]{11})$/.test(accountNumber)) { //then check for Diners Club
    result = "DINERS";
  }

  if (result == "AMEX") {
    //update security code check
    $('#cardSecurityCode').rules('remove', 'maxlength');
    $('#cardSecurityCode').rules('add', {
      maxlength: 4
    });
    $('#cardSecurityCode').rules('remove', ',minlength');
    $('#cardSecurityCode').rules('add', {
      minlength: 4
    });
  }

  $('.img_cardType').removeAttr('class').addClass('img_cardType ' + result).data('type', result);

  return result;
};

var fn_reloadUserMeta = function() {
  loadAjaxData(apiPath.userMetaUrl() + '&country=' + authenticatedInfo.countryIdentifier  + getHeaderParams(), {beforeSendCB: setHeader}, function(data) {

    updateSellingEntity(data);

    var hasDefaultPayment = false;
    arrPaymentGroupType = {};

    if (data.paymentTypes.length > 0) {
    	//reset all payment types
    	paymentTransactionParameters.paymentFormId = null;
    	
    	$.each(data.paymentTypes, function(index, pmt) {
    	  hasDefaultPayment = pmt.defaultPayment ? pmt.defaultPayment : hasDefaultPayment;
    	  bindPaymentData(pmt);

    	  if (pmt.defaultPayment) {
    	    //defaultPayment for recurring buyer, take scope != null
    	    if (!paymentTransactionParameters.recurringBuyer || (paymentTransactionParameters.recurringBuyer && (pmt.scope !== null))) {
    	    	$('#select-paymentType').val(pmt.paymentType).trigger('change');
    	    }
    	  }

    	  // // DROG-3381 reset SEPA info if user selects another country
       //  if (pmt.defaultPayment && pmt.paymentType == 'cpgSEPADirectDebit') {
       //    if ($("#sdd_bankAccountNumber").val().indexOf("*") != -1) {
       //      $("#sdd_bankRoutingCode, #sdd_bankAccountNumber").val("");
       //      $('#sdd_bankAccountNumber').rules('add', { sepa_validAccountNumber:true });
       //      paymentTransactionParameters.SDD.bankBillingInfoExternalId = null;
       //      $(".save input[for=cpgSEPADirectDebit]").removeAttr("checked");
       //    }
       //  }
       //  // DROG-4357 check if the bank ID exists
       //  if (pmt.defaultPayment && pmt.paymentType == 'cpgIBP') {
       //    // reset bank billing data
       //    paymentTransactionParameters.bankBilling.bankBillingInfoExternalId = null;
       //    $("#ibpBankName").val("").removeAttr('bank-id');
       //    $(".save input[for=cpgIBP]").removeAttr("checked");
       //  }

    	  arrPaymentGroupType[pmt.paymentType] = pmt.paymentGroupType;
    	});

			// // re-bind bank options for IBP payment
			// if (data.banks && typeof data.banks !== 'undefined' && (data.banks.length > 0)) {
			//   var bank_select = $("#ibpBankName");
			//   $("#ibpBankOptions").html("");
			//   for (var index in data.banks) {
			//     var bank = data.banks[index];
			//     $("#ibpBankOptions").append($("<li></li>").text(bank.bankName).attr('bank-id', bank.bankId));
			//   }
			//   $(bank_select).data("banks", data.banks);
			// }

    }

    // To show default payment type
    if( !hasDefaultPayment || $('.dr_paymentMethodBox').css('display') == 'none' ) {
      $('#select-paymentType').trigger('change');
    }

    //DROG-6305 re-bind offer after changing country
    var $selectedOffer = $('.dr_offerList > li[data-offer-id="'+paymentTransactionParameters.offerId+'"]');

    if ( $selectedOffer.length > 0 ) {
      $selectedOffer.addClass('selected').trigger('click');
    }

  });
};

var paymentOptionHandler = function() {
	var selectedOffer = paymentTransactionParameters.selectedOffer;
	var offer_paymentForm = selectedOffer.prices[0].paymentForms;

	if ( offer_paymentForm && offer_paymentForm.length > 0 ) {
		$('#select-paymentType option').each(function(index, pmtOption) {
			if ( $.inArray($(pmtOption).val(), offer_paymentForm) == -1 ) {
				$(pmtOption).remove();
			}
		});

		if ( $('#select-paymentType').val() != paymentTransactionParameters.paymentFormId ) {
			$('#select-paymentType').trigger('change');
		}

	} else {
		$('#select-paymentType').empty().html($('#select-paymentType-hidden option').clone());
		$('#select-paymentType').val(paymentTransactionParameters.paymentFormId).trigger('change');
	}
};

var paypalWindow;
var paypalWindowTimer;

var checkChild = function() {
  if (paypalWindow.closed) {
    cancelPaypalWindow();
  }
};

var cancelPaypalWindow = function() {
  //stop detecting close event of paypal window
  clearInterval(paypalWindowTimer);
  CheckState("#ProductSelection");
  var message = $.localize("drog.you.have.successfully.cancelled.your.transaction") + " <br /> " + $.localize("drog.please.try.again.by.using.a.different.payment.method");
  popupMessage(message);
};

var popupMessage = function(message) {
  var $dialog = $(".dr_msgWrapper");
  $dialog.find(".dr_msgText").html(message);
  $dialog.show();
};

var hidePopupMessage = function() {
  var $dialog = $(".dr_msgWrapper");
  $dialog.find(".dr_msgText").empty();
  $dialog.hide();
};

var resolveBackToTheStoreLink = function(purchase_finished) {
  if (purchase_finished) {
    if (getUrlVars().backToStore) {
      return $.localize("drog.back.to.store.purchase.finished.full.url." + getUrlVars().backToStore);
    } else {
      return $.localize("drog.back.to.store.purchase.finished.full.url");
    }
  } else if (getUrlVars().backToStore) {
    return $.localize("drog.back.to.store.full.url." + getUrlVars().backToStore);
  } else {
    return $.localize("drog.back.to.store.full.url");
  }

};

var discountOfferHandler = function(priceObj) {
  var discountContent = '';
  var currentPrice = priceObj.price;
  var originalPrice = priceObj.priceOriginal;

  var currentCurrency = (currentPrice && typeof currentPrice.symbol !== 'undefined') ? currentPrice.symbol : paymentTransactionParameters.currencyIdentifier;
  var currentAmount = (currentPrice && typeof currentPrice.decimalAmount !== 'undefined') ? (currentPrice.decimalAmount) : currentPrice;

  var originalCurrency = (originalPrice && typeof originalPrice.symbol !== 'undefined') ? originalPrice.symbol : paymentTransactionParameters.currencyIdentifier;
  var originalAmount = (originalPrice && typeof originalPrice.decimalAmount !== 'undefined') ? (originalPrice.decimalAmount) : originalPrice;

  if ( originalPrice && currentCurrency == originalCurrency && currentAmount != originalAmount ) {
    var subPrice = parseFloat(originalAmount) - parseFloat(currentAmount);

    if ( subPrice > 0 ) {
      var subPriceObj = $.extend(true, {}, priceObj);
      var originalPriceObj = $.extend(true, {}, priceObj);

      subPriceObj.price.decimalAmount = subPrice.toFixed(2);
      originalPriceObj.price.decimalAmount = originalAmount;

      var discountPercentage = Math.round((subPrice / originalAmount) * 100) + '%';
      discountContent = '<div class="dr_discount">' +
                          '<div>' + $.localize('drog.text.offer.discount.was') + ' ' + '<span class="dr_originalPrice">' + formatedPrice(originalPriceObj) + '</span></div>' +
                          '<div class="dr_saveRate">' + $.localize('drog.text.offer.discount.save') + ' ' + discountPercentage + '</div>' +
                        '</div>';
    }
  }

  return discountContent;
};

var countdownOfferHandler = function(offer, nowTS) {
  var countdownContent = '';

  if (isCountdownOffer(offer)) {
    var startTS =  new Date(offer.countdown.startDate);
    var endTS = new Date(offer.countdown.endDate);

    if ( endTS > nowTS && startTS <= nowTS ) {
      var diffTS = endTS - nowTS;
      var diff_seconds = parseInt((diffTS / 1000), 10);

      countdownContent = '<div class="dr_countdown">' + $.localize('drog.text.offer.countdown.ends.in') + ' <span class="dr_countdownText" data-seconds="' + diff_seconds + '"><span></div>';
    }
  }

  return countdownContent;
};

var bonusOfferHandler = function(offer, hasIcon) {
  var bonusContent = '';

  if ( offer.items && offer.items.length > 0 ) {
    var bonusGold = getObjectByLocale(offer.items[0].descriptions, storeLanguage).short;
    var bonusDesc = getObjectByLocale(offer.items[0].descriptions, storeLanguage).name;

    if ( bonusGold && parseInt(bonusGold) ) {
      if ( hasIcon ) {
        bonusContent = '<div class="dr_bonusGold">+ ' + $.localize('drog.text.offer.bonus') + ' ' + bonusGold +'</div>';

      } else {
        bonusContent = '<div class="dr_bonusGold">' + $.localize('drog.text.offer.bonus') + ' + ' + bonusGold +'</div>';
      }

      if ( bonusDesc ) {
        bonusContent += '<div class="dr_bonusDesc">' + bonusDesc + '</div>';
      }
    }
  }

  return bonusContent;
};

var setBattleCryLinks = function() {
  $('.link_faq').attr('href', $.localize('drog.link.battlecry.faq.url'));
  $('.link_tos').attr('href', $.localize('drog.link.battlecry.tos.url'));
};
