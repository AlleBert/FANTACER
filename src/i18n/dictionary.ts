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
  'search.removeCompany': string
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
  'contact.emailSubject': string
  'contact.emailIntro': string
  'contact.emailName': string
  'contact.emailAddress': string
  'contact.emailSentAt': string
  'contact.emailMessage': string

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
  'footer.madeBy': string

  // Cookie Policy
  'cookiePolicy.title': string
  'cookiePolicy.lastUpdated': string
  'cookiePolicy.intro': string
  'cookiePolicy.whatAreCookies': string
  'cookiePolicy.whatAreCookiesDesc': string
  'cookiePolicy.categories': string
  'cookiePolicy.essential': string
  'cookiePolicy.essentialDesc': string
  'cookiePolicy.analytics': string
  'cookiePolicy.analyticsDesc': string
  'cookiePolicy.thirdParty': string
  'cookiePolicy.thirdPartyDesc': string
  'cookiePolicy.howToManage': string
  'cookiePolicy.browserSettings': string
  'cookiePolicy.contact': string
  'cookiePolicy.tableCookie': string
  'cookiePolicy.tablePurpose': string
  'cookiePolicy.tableDuration': string
  'cookiePolicy.tableProvider': string
  'cookiePolicy.ga4Note': string

  // Privacy Policy
  'privacyPolicy.title': string
  'privacyPolicy.lastUpdated': string
  'privacyPolicy.controller': string
  'privacyPolicy.controllerDetails': string
  'privacyPolicy.dpo': string
  'privacyPolicy.dpoContact': string
  'privacyPolicy.dataCategories': string
  'privacyPolicy.purposes': string
  'privacyPolicy.legalBases': string
  'privacyPolicy.recipients': string
  'privacyPolicy.subprocessors': string
  'privacyPolicy.supabase': string
  'privacyPolicy.supabaseDesc': string
  'privacyPolicy.resend': string
  'privacyPolicy.resendDesc': string
  'privacyPolicy.cloudflare': string
  'privacyPolicy.cloudflareDesc': string
  'privacyPolicy.googleAnalytics': string
  'privacyPolicy.googleAnalyticsDesc': string
  'privacyPolicy.transfers': string
  'privacyPolicy.transfersDesc': string
  'privacyPolicy.retention': string
  'privacyPolicy.rights': string
  'privacyPolicy.howToExercise': string
  'privacyPolicy.complaint': string
  'privacyPolicy.changes': string
  'privacyPolicy.contact': string
  'privacyPolicy.dataContact': string
  'privacyPolicy.dataVoting': string
  'privacyPolicy.dataAdmin': string
  'privacyPolicy.dataAnalytics': string
  'privacyPolicy.dataTechnical': string
  'privacyPolicy.purposeContact': string
  'privacyPolicy.purposeVoting': string
  'privacyPolicy.purposeAdmin': string
  'privacyPolicy.purposeAnalytics': string
  'privacyPolicy.purposeSecurity': string
  'privacyPolicy.basisConsent': string
  'privacyPolicy.basisLegitimate': string
  'privacyPolicy.basisContract': string
  'privacyPolicy.basisLegalObligation': string
  'privacyPolicy.retentionContact': string
  'privacyPolicy.retentionVoting': string
  'privacyPolicy.retentionAdmin': string
  'privacyPolicy.retentionLogs': string
  'privacyPolicy.retentionAnalytics': string
  'privacyPolicy.rightsList': string

  // Terms & Conditions
  'terms.title': string
  'terms.lastUpdated': string
  'terms.acceptance': string
  'terms.acceptanceDesc': string
  'terms.serviceDescription': string
  'terms.eligibility': string
  'terms.eligibilityDesc': string
  'terms.votingRules': string
  'terms.oneVotePerDay': string
  'terms.threeCompanies': string
  'terms.prizeCollection': string
  'terms.prizeDetails': string
  'terms.fairDates': string
  'terms.gadget': string
  'terms.noCashAlternative': string
  'terms.unclaimedForfeited': string
  'terms.intellectualProperty': string
  'terms.brandOwnership': string
  'terms.companyLogos': string
  'terms.voteAttribution': string
  'terms.userContent': string
  'terms.userContentDesc': string
  'terms.disclaimer': string
  'terms.disclaimerDesc': string
  'terms.limitation': string
  'terms.maxLiability': string
  'terms.noIndirectDamages': string
  'terms.termination': string
  'terms.organizerMayEnd': string
  'terms.userMayStop': string
  'terms.provisionsSurvive': string
  'terms.governingLaw': string
  'terms.italianLaw': string
  'terms.tribunalReggio': string
  'terms.changes': string
  'terms.changesDesc': string
  'terms.contact': string
  'terms.contactDesc': string

  // Vote API errors
  'voteError.missingFields': string
  'voteError.duplicateCompanies': string
  'voteError.companiesNotFound': string
  'voteError.companyNotInBatch': string
  'voteError.missingSecurity': string
  'voteError.securityFailed': string
  'voteError.alreadyVoted': string

  // Legal pages - Summary boxes
  'cookiePolicy.summaryTitle': string
  'cookiePolicy.summaryText': string
  'cookiePolicy.essentialSectionTitle': string
  'cookiePolicy.analyticsSectionTitle': string
  'cookiePolicy.badgeAlwaysActive': string
  'cookiePolicy.badgeRequiresConsent': string

  'privacyPolicy.summaryTitle': string
  'privacyPolicy.summaryWho': string
  'privacyPolicy.summaryWhoDesc': string
  'privacyPolicy.summaryWhat': string
  'privacyPolicy.summaryWhatDesc': string
  'privacyPolicy.summaryHow': string
  'privacyPolicy.summaryHowDesc': string
  'privacyPolicy.summaryContact': string
  'privacyPolicy.summaryContactDesc': string

  'terms.summaryTitle': string
  'terms.summaryText': string
  'terms.goldenRulesTitle': string
  'terms.goldenRule1': string
  'terms.goldenRule2': string
  'terms.goldenRule3': string
  'terms.legalDetailsTitle': string
}

export type DictionaryKey = keyof Dictionary
