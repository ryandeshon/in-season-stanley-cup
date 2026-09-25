"""Generate the isolated Test draft stack. No production resource permissions."""
import json
from pathlib import Path
ref=lambda name: {'Ref':name}
arn=lambda name: {'Fn::GetAtt':[name,'Arn']}
sub=lambda value: {'Fn::Sub':value}
r={}
for kind in ['Players','Records','Options','Lifetime','Catalog','Connections']:
 keys=[('seasonId','S'),('id','N' if kind=='Records' else 'S')] if kind in ['Players','Records','Options'] else [('connectionId' if kind=='Connections' else 'id','S')]
 props={'BillingMode':'PAY_PER_REQUEST','AttributeDefinitions':[{'AttributeName':k,'AttributeType':t} for k,t in keys],'KeySchema':[{'AttributeName':k,'KeyType':'HASH' if i==0 else 'RANGE'} for i,(k,t) in enumerate(keys)]}
 if kind=='Connections': props['TimeToLiveSpecification']={'AttributeName':'expiresAt','Enabled':True}
 r[kind]={'Type':'AWS::DynamoDB::Table','Properties':props}
role={'AssumeRolePolicyDocument':{'Version':'2012-10-17','Statement':[{'Effect':'Allow','Principal':{'Service':'lambda.amazonaws.com'},'Action':'sts:AssumeRole'}]},'ManagedPolicyArns':['arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole']}
r['HttpRole']={'Type':'AWS::IAM::Role','Properties':dict(role,Policies=[{'PolicyName':'TestTablesOnly','PolicyDocument':{'Version':'2012-10-17','Statement':[{'Effect':'Allow','Action':['dynamodb:GetItem','dynamodb:PutItem','dynamodb:UpdateItem','dynamodb:DeleteItem','dynamodb:Scan','dynamodb:Query','dynamodb:ConditionCheckItem'],'Resource':[arn(k) for k in ['Players','Records','Options','Lifetime','Catalog']]}]}}])}
r['SocketRole']={'Type':'AWS::IAM::Role','Properties':dict(role,Policies=[{'PolicyName':'TestConnectionsOnly','PolicyDocument':{'Version':'2012-10-17','Statement':[{'Effect':'Allow','Action':['dynamodb:PutItem','dynamodb:DeleteItem','dynamodb:Scan'],'Resource':arn('Connections')},{'Effect':'Allow','Action':'execute-api:ManageConnections','Resource':sub('arn:${AWS::Partition}:execute-api:${AWS::Region}:${AWS::AccountId}:${SocketApi}/*/POST/@connections/*')}]}}])}
variables={'SEASON_STORAGE':'v2','SEASON_PLAYERS_TABLE':ref('Players'),'SEASON_RECORDS_TABLE':ref('Records'),'SEASON_OPTIONS_TABLE':ref('Options'),'PLAYER_LIFETIME_TABLE':ref('Lifetime'),'SEASON_CATALOG_TABLE':ref('Catalog'),'ADMIN_API_TOKEN':ref('AdminToken'),'DRAFT_PLAYER_TOKENS':ref('PlayerTokens'),'CORS_ORIGIN':'https://test.inseasoncup.com'}
r['HttpFunction']={'Type':'AWS::Lambda::Function','Properties':{'Runtime':'nodejs22.x','Handler':'index.handler','Role':arn('HttpRole'),'Timeout':20,'MemorySize':256,'Layers':[ref('SdkLayer')],'Environment':{'Variables':variables},'Code':{'ZipFile':'exports.handler = async () => ({statusCode:503,body:"Test API initializing"});'}}}
r['SocketFunction']={'Type':'AWS::Lambda::Function','Properties':{'Runtime':'nodejs22.x','Handler':'index.handler','Role':arn('SocketRole'),'Timeout':20,'MemorySize':256,'Environment':{'Variables':{'CONNECTIONS_TABLE':ref('Connections')}},'Code':{'ZipFile':Path(__file__).with_name('socket.cjs').read_text()}}}
r['HttpApi']={'Type':'AWS::ApiGatewayV2::Api','Properties':{'Name':'inseason-test-draft','ProtocolType':'HTTP','CorsConfiguration':{'AllowOrigins':['https://test.inseasoncup.com'],'AllowMethods':['GET','POST','PATCH','OPTIONS'],'AllowHeaders':['content-type','x-admin-token','x-draft-token']}}}
r['SocketApi']={'Type':'AWS::ApiGatewayV2::Api','Properties':{'Name':'inseason-test-draft-socket','ProtocolType':'WEBSOCKET','RouteSelectionExpression':'$request.body.action'}}
for kind in ['Http','Socket']:
 props={'ApiId':ref(kind+'Api'),'IntegrationType':'AWS_PROXY','IntegrationUri':arn(kind+'Function') if kind=='Http' else sub('arn:${AWS::Partition}:apigateway:${AWS::Region}:lambda:path/2015-03-31/functions/${SocketFunction.Arn}/invocations')}
 if kind=='Http': props['PayloadFormatVersion']='2.0'
 else: props['IntegrationMethod']='POST'
 r[kind+'Integration']={'Type':'AWS::ApiGatewayV2::Integration','Properties':props}
 r[kind+'Permission']={'Type':'AWS::Lambda::Permission','Properties':{'Action':'lambda:InvokeFunction','FunctionName':ref(kind+'Function'),'Principal':'apigateway.amazonaws.com','SourceArn':sub('arn:${AWS::Partition}:execute-api:${AWS::Region}:${AWS::AccountId}:${'+kind+'Api}/*')}}
 r[kind+'Stage']={'Type':'AWS::ApiGatewayV2::Stage','Properties':{'ApiId':ref(kind+'Api'),'StageName':'test','AutoDeploy':True,'DefaultRouteSettings':{'ThrottlingBurstLimit':30,'ThrottlingRateLimit':15}}}
for name,key in [('HttpDefault','$default'),('SocketConnect','$connect'),('SocketDisconnect','$disconnect'),('SocketDefault','$default')]:
 kind='Http' if name.startswith('Http') else 'Socket'
 r[name]={'Type':'AWS::ApiGatewayV2::Route','Properties':{'ApiId':ref(kind+'Api'),'RouteKey':key,'Target':{'Fn::Join':['/', ['integrations',ref(kind+'Integration')]]}}}
outputs={k:{'Value':ref(k)} for k in ['Players','Records','Options','Lifetime','Catalog','Connections','HttpFunction','SocketFunction']}
outputs['HttpUrl']={'Value':sub('https://${HttpApi}.execute-api.${AWS::Region}.amazonaws.com/test')}
outputs['SocketUrl']={'Value':sub('wss://${SocketApi}.execute-api.${AWS::Region}.amazonaws.com/test')}
print(json.dumps({'AWSTemplateFormatVersion':'2010-09-09','Description':'Isolated disposable Test draft and real WebSocket transport','Parameters':{'AdminToken':{'Type':'String','NoEcho':True},'PlayerTokens':{'Type':'String','NoEcho':True},'SdkLayer':{'Type':'String'}},'Resources':r,'Outputs':outputs},indent=2))
