export function MailHtmlFrame({ html }: { html: string }) {
  return (
    <iframe
      title="邮件 HTML 正文"
      sandbox=""
      referrerPolicy="no-referrer"
      srcDoc={html}
      className="h-[32rem] w-full border-0 bg-white"
    />
  )
}
