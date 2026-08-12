export interface Dictionary {
  // Metadata / SEO
  'meta.title': string
  'meta.description': string

  // Hero
  'hero.play': string

  // Intro
  'intro.title.line1': string
  'intro.title.line2': string
  'intro.title.line3': string
  'intro.subtitle': string
  'intro.discover': string

  // How it works
  'howItWorks.title.simple': string
  'howItWorks.title.win': string
  'howItWorks.step.vote': string
  'howItWorks.step.share': string
  'howItWorks.step.collect': string

  // Play again
  'playAgain.text': string
  'playAgain.dates': string

  // Prize location
  'prize.title': string
  'prize.inside': string
  'prize.venue': string
  'prize.dates': string

  // Search / vote
  'search.title': string
  'search.placeholder': string
  'search.alreadySelected': string
  'search.viewAll': string
  'search.changePallet': string
  'search.assignPallet': string
  'search.palletBadge': string
  'search.confirm': string
  'search.submit': string
  'search.subtitle': string
  'search.msgSuccessTitle': string
  'search.msgErrorTitle': string
  'search.msgWarningTitle': string
  'search.errVote': string
  'search.errUnknown': string

  // Success
  'success.voted': string
  'success.noCompany': string
  'success.bestStand': string
  'success.playToo1': string
  'success.playToo2': string
  'success.youRock': string
  'success.shareSocial': string
  'success.shareTagging': string
  'success.collectPrize': string

  // Public ranking
  'publicRanking.title': string

  // Live ranking
  'liveRanking.title': string
  'liveRanking.subtitle': string
  'liveRanking.error': string
  'liveRanking.retry': string
  'liveRanking.empty': string
  'liveRanking.pallets': string
  'liveRanking.hide': string
  'liveRanking.showAll': string

  // Contact
  'contact.title1': string
  'contact.title2': string
  'contact.sendMessage': string
  'contact.success': string
  'contact.error': string
  'contact.namePlaceholder': string
  'contact.emailPlaceholder': string
  'contact.messagePlaceholder': string
  'contact.nameLabel': string
  'contact.emailLabel': string
  'contact.messageLabel': string
  'contact.sending': string
  'contact.submit': string

  // Turnstile overlay
  'turnstile.ready': string
  'turnstile.verify': string
  'turnstile.voteOnItsWay': string
  'turnstile.confirmHuman': string
  'turnstile.error': string
  'turnstile.ok': string
  'turnstile.verifying': string
  'turnstile.noPersonalData': string

  // Message overlay
  'messageOverlay.footer': string

  // Coming soon
  'comingSoon.title': string

  // Cookie consent (react-cookie-manager)
  'cookie.title': string
  'cookie.message': string
  'cookie.buttonText': string
  'cookie.declineButtonText': string
  'cookie.manageButtonText': string
  'cookie.manageTitle': string
  'cookie.manageMessage': string
  'cookie.essentialTitle': string
  'cookie.essentialSubtitle': string
  'cookie.essentialStatus': string
  'cookie.analyticsTitle': string
  'cookie.analyticsSubtitle': string
  'cookie.socialTitle': string
  'cookie.socialSubtitle': string
  'cookie.advertTitle': string
  'cookie.advertSubtitle': string
  'cookie.saveButtonText': string
  'cookie.cancelButtonText': string

  // Footer / legal
  'footer.cookieConsent': string
  'footer.cookiePolicy': string
  'footer.privacyPolicy': string
  'footer.terms': string
  'footer.legalNotices': string
  'footer.madeBy': string

  // Vote API errors
  'voteError.missingFields': string
  'voteError.duplicateCompanies': string
  'voteError.companiesNotFound': string
  'voteError.companyNotInBatch': string
  'voteError.missingSecurity': string
  'voteError.securityFailed': string
  'voteError.alreadyVoted': string
}

export type DictionaryKey = keyof Dictionary
